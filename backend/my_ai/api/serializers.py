from rest_framework import serializers
from .models import Project, UploadedFile, ChatSession, ChatMessage, MODEL_CHOICES

class ProjectSerializer(serializers.ModelSerializer):
    model = serializers.ChoiceField(choices=MODEL_CHOICES, required=False)

    class Meta:
        model = Project
        fields = ['id', 'name', 'model', 'openai_vector_store_id', 'openai_assistant_id', 'created_at']
        read_only_fields = ['id', 'openai_vector_store_id', 'openai_assistant_id', 'created_at']

class UploadedFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UploadedFile
        fields = ['id', 'project', 'filename', 'openai_file_id', 'uploaded_at']
        read_only_fields = ['id', 'project', 'openai_file_id', 'uploaded_at']

class ChatSessionSerializer(serializers.ModelSerializer):
    # Make name writable during creation, but still optional
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)

    class Meta:
        model = ChatSession
        fields = ['id', 'project', 'openai_thread_id', 'created_at', 'name']
        # Keep thread_id read-only as it's generated internally
        read_only_fields = ['id', 'project', 'openai_thread_id', 'created_at']

class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'session', 'role', 'content', 'timestamp']
        read_only_fields = ['id', 'session', 'timestamp'] # Role and content are provided or generated
