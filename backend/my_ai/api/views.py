from django.shortcuts import render, get_object_or_404
from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.contrib.auth import authenticate
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics, serializers
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from openai import OpenAI
import os
import logging

from .models import Project, UploadedFile, ChatSession, ChatMessage
from .serializers import ProjectSerializer, UploadedFileSerializer, ChatSessionSerializer, ChatMessageSerializer

# Configure logging
logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = OpenAI(api_key=settings.OPENAI_API_KEY)

# --- Helper Function to get or create Assistant --- #
def get_or_create_assistant(project):
    if project.openai_assistant_id:
        try:
            assistant = client.beta.assistants.retrieve(project.openai_assistant_id)

            # Check and update model if it differs from project setting
            if assistant.model != project.model:
                logger.warning(f"Assistant {assistant.id} model ({assistant.model}) differs from project setting ({project.model}). Updating.")
                assistant = client.beta.assistants.update(
                    assistant_id=assistant.id,
                    model=project.model # Update the model
                )
                logger.info(f"Updated Assistant {assistant.id} model to {project.model}.")

            # Ensure the assistant is still linked to the correct vector store
            if not assistant.tool_resources or not assistant.tool_resources.file_search or project.openai_vector_store_id not in assistant.tool_resources.file_search.vector_store_ids:
                logger.warning(f"Assistant {assistant.id} not linked to vector store {project.openai_vector_store_id}. Updating.")
                assistant = client.beta.assistants.update(
                    assistant_id=assistant.id,
                    tool_resources={"file_search": {"vector_store_ids": [project.openai_vector_store_id]}}
                )
                logger.info(f"Updated Assistant {assistant.id} linkage.")
            return assistant
        except Exception as e:
            logger.error(f"Failed to retrieve or update assistant {project.openai_assistant_id}, creating new one: {e}")

    if not project.openai_vector_store_id:
        raise ValueError("Project must have a vector store before creating an assistant.")

    try:
        assistant = client.beta.assistants.create(
            name=f"Assistant for Project {project.id} - {project.name}",
            instructions="You are a helpful chatbot. Use the provided files associated with this project to answer questions accurately. When referencing information from a file, please indicate the source.",
            model=project.model, # Use the model from the project
            tools=[{"type": "file_search"}],
            tool_resources={"file_search": {"vector_store_ids": [project.openai_vector_store_id]}}
        )
        project.openai_assistant_id = assistant.id
        project.save()
        logger.info(f"Created new Assistant {assistant.id} for Project {project.id} using model {project.model}")
        return assistant
    except Exception as e:
        logger.error(f"Error creating Assistant for Project {project.id}: {e}")
        raise

# --- Project Views --- #
class ProjectListCreateView(generics.ListCreateAPIView):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer

class ProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    lookup_url_kwarg = 'project_id'

# --- File Upload View --- #
class FileUploadView(APIView):
    def post(self, request, project_id, *args, **kwargs):
        project = get_object_or_404(Project, pk=project_id)
        file_obj = request.FILES.get('file')

        if not file_obj:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

        openai_file = None
        vector_store_id = project.openai_vector_store_id
        fs = FileSystemStorage(location=os.path.join(settings.BASE_DIR, 'tmp'))
        filename = None

        try:
            # --- 1. Ensure Vector Store Exists --- #
            if not vector_store_id:
                logger.info(f"No vector store found for Project {project.id}. Creating one.")
                vector_store = client.vector_stores.create(name=f"Vector Store for Project {project.id} - {project.name}")
                vector_store_id = vector_store.id
                project.openai_vector_store_id = vector_store_id
                project.save()
                logger.info(f"Created Vector Store {vector_store_id} for Project {project.id}")

            # --- 2. Upload file to OpenAI --- #
            filename = fs.save(file_obj.name, file_obj)
            file_path = fs.path(filename)

            with open(file_path, "rb") as f:
                openai_file = client.files.create(
                    file=f,
                    purpose="assistants"
                )
            logger.info(f"File uploaded to OpenAI with ID: {openai_file.id}")

            # --- 3. Add File to Vector Store --- #
            file_batch = client.vector_stores.file_batches.create_and_poll(
                vector_store_id=vector_store_id,
                file_ids=[openai_file.id]
            )

            if file_batch.status != 'completed':
                logger.error(f"Failed to add file {openai_file.id} to Vector Store {vector_store_id}. Batch status: {file_batch.status}, Errors: {file_batch.last_error}")
                try:
                    client.files.delete(openai_file.id)
                    logger.info(f"Cleaned up OpenAI file {openai_file.id} due to Vector Store addition failure.")
                except Exception as delete_e:
                    logger.error(f"Error cleaning up OpenAI file {openai_file.id}: {delete_e}")
                return Response({"error": f"Failed to add file to project knowledge base. Status: {file_batch.status}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            logger.info(f"File {openai_file.id} successfully added to Vector Store {vector_store_id}")

            # --- 4. Create Database Record --- #
            uploaded_file_instance = UploadedFile.objects.create(
                project=project,
                filename=file_obj.name,
                openai_file_id=openai_file.id
            )
            serializer = UploadedFileSerializer(uploaded_file_instance)

            # --- 5. Clean up temporary file --- #
            fs.delete(filename)

            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Error during file upload for project {project_id}: {e}", exc_info=True)
            if openai_file:
                try:
                    retrieved_file = client.files.retrieve(openai_file.id)
                    if retrieved_file:
                        client.files.delete(openai_file.id)
                        logger.info(f"Cleaned up OpenAI file {openai_file.id} due to error.")
                except Exception as delete_e:
                    logger.error(f"Error cleaning up OpenAI file {openai_file.id}: {delete_e}")
            if filename and fs.exists(filename):
                fs.delete(filename)
                logger.info(f"Cleaned up temporary file {filename}")

            return Response({"error": f"An unexpected error occurred: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# --- File List View --- #
class FileListView(generics.ListAPIView):
    serializer_class = UploadedFileSerializer

    def get_queryset(self):
        project_id = self.kwargs['project_id']
        return UploadedFile.objects.filter(project_id=project_id).order_by('-uploaded_at')

# --- Chat Session Views --- #
class ChatSessionListCreateView(generics.ListCreateAPIView):
    serializer_class = ChatSessionSerializer

    def get_queryset(self):
        project_id = self.kwargs['project_id']
        return ChatSession.objects.filter(project_id=project_id)

    def perform_create(self, serializer):
        project = get_object_or_404(Project, pk=self.kwargs['project_id'])
        try:
            thread = client.beta.threads.create()
            logger.info(f"Created new OpenAI Thread {thread.id} for Project {project.id}")
            serializer.save(project=project, openai_thread_id=thread.id)
        except Exception as e:
            logger.error(f"Failed to create OpenAI thread for project {project.id}: {e}")
            raise serializers.ValidationError("Failed to initialize chat session with OpenAI.")

class ChatSessionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ChatSessionSerializer
    lookup_url_kwarg = 'session_id'

    def get_queryset(self):
        project_id = self.kwargs['project_id']
        return ChatSession.objects.filter(project_id=project_id)

    def perform_destroy(self, instance):
        try:
            if instance.openai_thread_id:
                client.beta.threads.delete(instance.openai_thread_id)
                logger.info(f"Deleted OpenAI Thread {instance.openai_thread_id}")
        except Exception as e:
            logger.error(f"Failed to delete OpenAI Thread {instance.openai_thread_id}: {e}")
        instance.delete()

# --- Chat Interaction View --- #
class ChatMessageView(APIView):
    def post(self, request, project_id, session_id, *args, **kwargs):
        project = get_object_or_404(Project, pk=project_id)
        chat_session = get_object_or_404(ChatSession, pk=session_id, project=project)
        user_message_content = request.data.get('message')

        if not user_message_content:
            return Response({"error": "No message provided"}, status=status.HTTP_400_BAD_REQUEST)

        if not project.openai_vector_store_id:
             return Response({"error": "Project has no associated knowledge base (Vector Store). Upload files first."}, status=status.HTTP_400_BAD_REQUEST)

        thread_id = chat_session.openai_thread_id

        try:
            # --- Save User Message to DB --- #
            ChatMessage.objects.create(
                session=chat_session,
                role='user',
                content=user_message_content
            )
            logger.info(f"Saved user message for session {session_id}")

            assistant = get_or_create_assistant(project)
            assistant_id = assistant.id

            # Add message to OpenAI thread
            message = client.beta.threads.messages.create(
                thread_id=thread_id,
                role="user",
                content=user_message_content,
            )

            # Run the assistant
            run = client.beta.threads.runs.create_and_poll(
                thread_id=thread_id,
                assistant_id=assistant_id,
            )

            if run.status == 'completed':
                messages = client.beta.threads.messages.list(
                    thread_id=thread_id,
                    order="asc",
                    after=message.id # Fetch messages created after the user's message
                )
                assistant_responses_content = []
                citations = []
                full_assistant_response_text = ""

                for msg in messages.data:
                    if msg.role == "assistant":
                        current_message_text = ""
                        for content_block in msg.content:
                             if content_block.type == 'text':
                                 text_value = content_block.text.value
                                 current_message_text += text_value # Accumulate text from blocks
                                 # Process citations within this text block
                                 if hasattr(content_block.text, 'annotations') and content_block.text.annotations:
                                     processed_text_value = text_value
                                     for index, annotation in enumerate(content_block.text.annotations):
                                         # Use a unique marker based on citation list length
                                         marker = f" [{len(citations) + 1}]"
                                         processed_text_value = processed_text_value.replace(annotation.text, marker)
                                         if hasattr(annotation, 'file_citation'):
                                             try:
                                                 cited_file = client.files.retrieve(annotation.file_citation.file_id)
                                                 citations.append({
                                                     "marker": marker.strip(), # Store without spaces
                                                     "file_id": cited_file.id,
                                                     "filename": cited_file.filename,
                                                     "quote": annotation.text
                                                 })
                                                 logger.info(f"Citation{marker}: File '{cited_file.filename}' (ID: {cited_file.id})")
                                             except Exception as cite_err:
                                                 logger.error(f"Error retrieving cited file {annotation.file_citation.file_id}: {cite_err}")
                                         elif hasattr(annotation, 'file_path'):
                                              try:
                                                  cited_file = client.files.retrieve(annotation.file_path.file_id)
                                                  citations.append({
                                                     "marker": marker.strip(), # Store without spaces
                                                     "file_id": cited_file.id,
                                                     "filename": cited_file.filename,
                                                     "type": "file_path"
                                                 })
                                                  logger.info(f"Citation{marker}: File Path in '{cited_file.filename}' (ID: {cited_file.id})")
                                              except Exception as cite_err:
                                                  logger.error(f"Error retrieving cited file path {annotation.file_path.file_id}: {cite_err}")
                                     # Update the accumulated text with processed citations for this block
                                     current_message_text = current_message_text.replace(text_value, processed_text_value)

                        if current_message_text:
                            assistant_responses_content.append(current_message_text)

                full_assistant_response_text = "\n".join(assistant_responses_content)

                if not full_assistant_response_text:
                     logger.warning(f"Run {run.id} completed but no assistant message content found.")
                     # Still save an empty assistant message? Or handle differently?
                     # For now, let's not save an empty message.
                     return Response({"reply": "Assistant processed the request but did not generate a text response.", "citations": []})
                else:
                    # --- Save Assistant Message to DB --- #
                    ChatMessage.objects.create(
                        session=chat_session,
                        role='assistant',
                        content=full_assistant_response_text # Save the combined/processed text
                    )
                    logger.info(f"Saved assistant message for session {session_id}")

                return Response({"reply": full_assistant_response_text, "citations": citations})

            elif run.status == 'requires_action':
                 logger.warning(f"Run {run.id} requires action (e.g., function call), which is not implemented.")
                 return Response({"error": "Assistant run requires further action."}, status=status.HTTP_501_NOT_IMPLEMENTED)
            else:
                logger.error(f"Assistant run failed or stopped. Status: {run.status}, Error: {run.last_error}")
                error_message = f"Assistant run failed: {run.status}"
                if run.last_error:
                    error_message += f" - {run.last_error.message} (Code: {run.last_error.code})"
                return Response({"error": error_message}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        except Exception as e:
            logger.error(f"Error during chat processing for session {session_id}: {e}", exc_info=True)
            return Response({"error": f"An unexpected error occurred: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# --- New View to List Messages for a Session --- #
class ChatMessageListView(generics.ListAPIView):
    serializer_class = ChatMessageSerializer

    def get_queryset(self):
        project_id = self.kwargs['project_id']
        session_id = self.kwargs['session_id']
        # Ensure the session belongs to the project before querying messages
        get_object_or_404(ChatSession, pk=session_id, project_id=project_id)
        return ChatMessage.objects.filter(session_id=session_id).order_by('timestamp')

# --- Authentication Views --- #
@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response({"error": "Username and password are required."}, status=status.HTTP_400_BAD_REQUEST)

    user = authenticate(request, username=username, password=password)

    if user is not None:
        # Authentication successful, generate or get auth token
        token, created = Token.objects.get_or_create(user=user)
        logger.info(f"User {username} logged in successfully.")
        return Response({"token": token.key}, status=status.HTTP_200_OK)
    else:
        logger.warning(f"Failed login attempt for user {username}.")
        return Response({"error": "Invalid username or password."}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    try:
        request.user.auth_token.delete()
        logger.info(f"User {request.user.username} logged out successfully.")
        return Response({"message": "Logged out successfully."}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error logging out user {request.user.username}: {e}")
        return Response({"error": "An error occurred while logging out."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
