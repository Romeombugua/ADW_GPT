import { useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

/**
 * MobileHandler component for improving mobile experience
 * Handles mobile-specific behavior like auto-collapsing sidebars on small screens
 * and detecting screen size changes
 */
function MobileHandler({ 
  setProjectsPanelCollapsed, 
  setSessionsPanelCollapsed,
  selectedProject,
  selectedSession
}) {
  // Detect mobile devices
  const isMobileDevice = useCallback(() => {
    return window.innerWidth <= 768;
  }, []);

  // Auto-collapse sidebars on mobile when needed
  useEffect(() => {
    const handleResize = () => {
      const isMobile = isMobileDevice();
      
      if (isMobile) {
        // On mobile, collapse the projects panel when a project is selected
        if (selectedProject) {
          setProjectsPanelCollapsed(true);
        }
        
        // On mobile, collapse both panels when a session is active
        if (selectedSession) {
          setProjectsPanelCollapsed(true);
          setSessionsPanelCollapsed(true);
        }
      } else {
        // On desktop, always expand both panels
        setProjectsPanelCollapsed(false);
        setSessionsPanelCollapsed(false);
      }
    };

    // Initial call to set up the correct state
    handleResize();

    // Add event listener for window resize
    window.addEventListener('resize', handleResize);

    // Clean up event listener
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobileDevice, setProjectsPanelCollapsed, setSessionsPanelCollapsed, selectedProject, selectedSession]);

  // Auto-collapse panels when user selects something on mobile
  useEffect(() => {
    if (isMobileDevice() && selectedProject) {
      setProjectsPanelCollapsed(true);
    }
  }, [selectedProject, setProjectsPanelCollapsed, isMobileDevice]);

  useEffect(() => {
    if (isMobileDevice() && selectedSession) {
      setProjectsPanelCollapsed(true);
      setSessionsPanelCollapsed(true);
    }
  }, [selectedSession, setProjectsPanelCollapsed, setSessionsPanelCollapsed, isMobileDevice]);

  // This is a utility component that doesn't render anything
  return null;
}

MobileHandler.propTypes = {
  setProjectsPanelCollapsed: PropTypes.func.isRequired,
  setSessionsPanelCollapsed: PropTypes.func.isRequired,
  selectedProject: PropTypes.object,
  selectedSession: PropTypes.object
};

export default MobileHandler;