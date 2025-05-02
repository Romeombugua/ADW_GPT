from django.db import models

# Define choices for the model field based on common availability
# You might want to dynamically fetch this list or update it periodically
MODEL_CHOICES = [
    ("gpt-4o", "GPT-4o (Recommended)"),
    ("gpt-4-turbo", "GPT-4 Turbo"),
    ("gpt-3.5-turbo", "GPT-3.5 Turbo"),
    ("gpt-4.1", "GPT-4.1"),
    ("gpt-4.5-preview", "GPT-4.5 Preview"),
    # Add other models as needed
]

class Project(models.Model):
    name = models.CharField(max_length=255)
    # Store the OpenAI Vector Store ID associated with this project
    openai_vector_store_id = models.CharField(max_length=255, blank=True, null=True)
    # Store the OpenAI Assistant ID associated with this project (optional, could be created on demand)
    openai_assistant_id = models.CharField(max_length=255, blank=True, null=True)
    # Add model field with choices and default
    model = models.CharField(
        max_length=50,
        choices=MODEL_CHOICES,
        default="gpt-4o",
        help_text="The OpenAI model used by the assistant for this project."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class UploadedFile(models.Model):
    project = models.ForeignKey(Project, related_name='files', on_delete=models.CASCADE)
    # Original filename from the user
    filename = models.CharField(max_length=255)
    # Store the OpenAI File ID
    openai_file_id = models.CharField(max_length=255, unique=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.filename} (Project: {self.project.name})"

class ChatSession(models.Model):
    project = models.ForeignKey(Project, related_name='chat_sessions', on_delete=models.CASCADE)
    # Store the OpenAI Thread ID
    openai_thread_id = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # Optional: Store a name or summary for the session
    name = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"Chat Session {self.id} (Project: {self.project.name})"

class ChatMessage(models.Model):
    ROLE_CHOICES = [
        ('user', 'User'),
        ('assistant', 'Assistant'),
    ]
    session = models.ForeignKey(ChatSession, related_name='messages', on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    # Optional: Store OpenAI message ID if needed for correlation
    # openai_message_id = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        ordering = ['timestamp'] # Ensure messages are ordered chronologically

    def __str__(self):
        return f"{self.role.capitalize()} message in Session {self.session.id} at {self.timestamp}"
