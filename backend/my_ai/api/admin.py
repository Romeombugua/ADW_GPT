from django.contrib import admin

from .models import Project, UploadedFile, ChatSession

admin.site.register(Project)
admin.site.register(UploadedFile)
admin.site.register(ChatSession)

# Register your models here.
