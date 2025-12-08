import React, { useState } from 'react';
import { cameraService } from '../services/cameraService';

const CameraTest = ({ onClose }) => {
  const [cameraInfo, setCameraInfo] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState([]);

  const runCameraTests = async () => {
    setTesting(true);
    setTestResults([]);
    
    const results = [];
    
    try {
      results.push('🔍 Testing device capabilities...');
      setTestResults([...results]);
      
      const isMobile = cameraService.isMobileDevice();
      const isPWA = cameraService.isPWA();
      results.push(`📱 Mobile Device: ${isMobile ? '✅ Yes' : '❌ No'}`);
      results.push(`🚀 PWA Mode: ${isPWA ? '✅ Yes' : '❌ No'}`);
      setTestResults([...results]);
      
      // Test 2: Camera Availability
      results.push('📷 Checking camera availability...');
      setTestResults([...results]);
      
      const hasCamera = await cameraService.checkCameraAvailability();
      results.push(`📹 Camera Detected: ${hasCamera ? '✅ Yes' : '❌ No'}`);
      setTestResults([...results]);
      
      // Test 3: Permission Status
      results.push('🔐 Checking camera permissions...');
      setTestResults([...results]);
      
      const permissionState = await cameraService.checkCameraPermission();
      results.push(`🛡️ Permission Status: ${
        permissionState === 'granted' ? '✅ Granted' :
        permissionState === 'denied' ? '❌ Denied' :
        permissionState === 'prompt' ? '⚠️ Will prompt' :
        '❓ Unknown'
      }`);
      setTestResults([...results]);
      
      // Test 4: Get Full Info
      results.push('📊 Getting comprehensive camera info...');
      setTestResults([...results]);
      
      const info = await cameraService.getCameraInfo();
      setCameraInfo(info);
      
      results.push(`🎯 Camera Support Score: ${
        info.supportsCapture ? '✅ Excellent' :
        info.hasCamera && info.isMobile ? '⚠️ Good' :
        info.hasCamera ? '⚠️ Limited' :
        '❌ Not Supported'
      }`);
      
      setTestResults([...results]);
      
    } catch (error) {
      results.push(`❌ Test Error: ${error.message}`);
      setTestResults([...results]);
    }
    
    setTesting(false);
  };

  const requestPermission = async () => {
    try {
      const granted = await cameraService.requestCameraPermission();
      if (granted) {
        alert('✅ Camera permission granted! You can now take photos.');
        runCameraTests(); // Re-run tests to update status
      } else {
        alert('❌ Camera permission denied. Please check your browser settings.');
      }
    } catch (error) {
      alert(`❌ Failed to request camera permission: ${error.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">📷 Camera Test</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">
              Test your device's camera capabilities for this PWA.
            </p>
            
            <button
              onClick={runCameraTests}
              disabled={testing}
              className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? '🔄 Testing...' : '🧪 Run Camera Tests'}
            </button>
            
            {testResults.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-2">Test Results:</h3>
                <div className="space-y-1 text-sm font-mono">
                  {testResults.map((result, index) => (
                    <div key={index} className="text-gray-700">
                      {result}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {cameraInfo && (
              <div className="space-y-3">
                {cameraInfo.hasCamera && cameraInfo.permissionState !== 'granted' && (
                  <button
                    onClick={requestPermission}
                    className="w-full bg-green-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-600"
                  >
                    🔐 Request Camera Permission
                  </button>
                )}
                
                <div className="bg-blue-50 rounded-lg p-3">
                  <h4 className="font-semibold text-blue-800 mb-2">💡 Tips:</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    {!cameraInfo.isMobile && (
                      <li>• Camera works best on mobile devices</li>
                    )}
                    {!cameraInfo.isPWA && (
                      <li>• Install this app as PWA for better camera experience</li>
                    )}
                    {cameraInfo.hasCamera && cameraInfo.permissionState === 'denied' && (
                      <li>• Reset camera permissions in browser settings</li>
                    )}
                    {!cameraInfo.hasCamera && (
                      <li>• You can still upload photos from your gallery</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraTest;
