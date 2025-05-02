import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import * as apiService from '../apiService';

function FileUpload({ selectedProject, isLoading, onError }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  useEffect(() => {
    if (selectedProject) {
      fetchUploadedFiles();
    } else {
      setUploadedFiles([]);
    }
  }, [selectedProject, uploadSuccess]);

  const fetchUploadedFiles = async () => {
    if (!selectedProject) return;
    
    setLoadingFiles(true);
    try {
      const response = await apiService.fetchFiles(selectedProject.id);
      setUploadedFiles(response.data);
    } catch (err) {
      console.error("Error fetching files:", err);
      onError('Failed to load uploaded files.');
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadSuccess(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setUploadSuccess(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !selectedProject) return;

    setUploading(true);
    onError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      await apiService.uploadFile(selectedProject.id, formData);
      setUploadSuccess(true);
      setFile(null);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // Refresh the file list
      fetchUploadedFiles();
    } catch (err) {
      console.error("Error uploading file:", err);
      onError('Failed to upload file.');
    } finally {
      setUploading(false);
    }
  };

  const openFileSelector = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <h3 className="file-upload-title">Upload Files</h3>
      
      <div 
        className="file-drop-area"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={openFileSelector}
      >
        {file ? (
          <div>
            <p>Selected: {file.name}</p>
            <p>({Math.round(file.size / 1024)} KB)</p>
          </div>
        ) : (
          <div>
            <p>Drag & drop or click to select</p>
            <p style={{ fontSize: '0.8rem', marginTop: '4px', opacity: 0.7 }}>
              Supported formats: .txt, .pdf, .docx, etc.
            </p>
          </div>
        )}
        
        <input
          type="file"
          onChange={handleFileChange}
          className="file-input"
          ref={fileInputRef}
          disabled={isLoading || uploading || !selectedProject}
        />
      </div>

      {file && (
        <button 
          onClick={handleUpload} 
          className="btn btn-primary" 
          style={{ width: '100%' }}
          disabled={isLoading || uploading || !selectedProject}
        >
          {uploading ? 'Uploading...' : 'Upload File'}
        </button>
      )}

      {uploadSuccess && (
        <div className="success-message" style={{ marginTop: '8px', color: 'var(--success)', fontSize: '0.8rem' }}>
          File uploaded successfully!
        </div>
      )}

      {/* Display uploaded files */}
      <div className="uploaded-files-section">
        <h3 className="file-upload-title" style={{ marginTop: '24px' }}>Uploaded Files</h3>
        
        {loadingFiles ? (
          <div className="loading-indicator">Loading files...</div>
        ) : uploadedFiles.length > 0 ? (
          <ul className="uploaded-files-list">
            {uploadedFiles.map((uploadedFile) => (
              <li key={uploadedFile.id} className="uploaded-file-item">
                <span className="file-icon">📄</span>
                <div className="file-details">
                  <span className="file-name">{uploadedFile.filename}</span>
                  <span className="file-date">{new Date(uploadedFile.uploaded_at).toLocaleDateString()}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-files">
            <p>No files uploaded yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

FileUpload.propTypes = {
  selectedProject: PropTypes.object,
  isLoading: PropTypes.bool.isRequired,
  onError: PropTypes.func.isRequired,
};

export default FileUpload;
