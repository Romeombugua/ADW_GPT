from django.urls import path
from .views import (
    ProjectListCreateView,
    ProjectDetailView,
    FileUploadView,
    FileListView,
    ChatSessionListCreateView,
    ChatSessionDetailView,
    ChatMessageView,
    ChatMessageListView,
    login_view,
    logout_view
)

urlpatterns = [
    # Authentication URLs
    path('login/', login_view, name='login'),
    path('logout/', logout_view, name='logout'),
    
    # Project URLs
    path('projects/', ProjectListCreateView.as_view(), name='project-list-create'),
    path('projects/<int:project_id>/', ProjectDetailView.as_view(), name='project-detail'),

    # File Upload and List URLs (scoped to a project)
    path('projects/<int:project_id>/upload/', FileUploadView.as_view(), name='file-upload'),
    path('projects/<int:project_id>/files/', FileListView.as_view(), name='file-list'),

    # Chat Session URLs (scoped to a project)
    path('projects/<int:project_id>/sessions/', ChatSessionListCreateView.as_view(), name='chatsession-list-create'),
    path('projects/<int:project_id>/sessions/<int:session_id>/', ChatSessionDetailView.as_view(), name='chatsession-detail'),

    # Chat Message URL (scoped to a project and session)
    path('projects/<int:project_id>/sessions/<int:session_id>/chat/', ChatMessageView.as_view(), name='chat-message'),

    # --- URL for Listing Messages --- #
    path('projects/<int:project_id>/sessions/<int:session_id>/messages/', ChatMessageListView.as_view(), name='chatmessage-list'),
]
