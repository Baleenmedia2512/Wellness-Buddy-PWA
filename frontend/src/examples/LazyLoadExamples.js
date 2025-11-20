// src/examples/LazyLoadExamples.js
import React from 'react';
import LazyLoad from '../components/LazyLoad';
import LazyLoadImage from '../components/LazyLoadImage';

/**
 * Example 1: Lazy Loading Cards
 * Shows how cards load/unload when scrolling up and down
 */
export const LazyCardExample = () => {
  const cards = Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    title: `Card ${i + 1}`,
    content: `This is card number ${i + 1}. Scroll up and down to see lazy loading in action!`
  }));

  return (
    <div className="lazy-card-demo">
      <h2>Bidirectional Lazy Loading Demo</h2>
      <p>Scroll down and then back up - watch the console to see loading behavior</p>
      
      <div className="card-list">
        {cards.map((card) => (
          <LazyLoad
            key={card.id}
            rootMargin="100px"
            threshold={0.1}
            minHeight="150px"
            onVisibilityChange={(visible) => {
              console.log(`Card ${card.id}: ${visible ? 'VISIBLE' : 'HIDDEN'}`);
            }}
          >
            <div className="card" style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '16px',
              background: 'white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              minHeight: '150px'
            }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#333' }}>{card.title}</h3>
              <p style={{ margin: 0, color: '#666' }}>{card.content}</p>
              <small style={{ color: '#999', display: 'block', marginTop: '8px' }}>
                Rendered at: {new Date().toLocaleTimeString()}
              </small>
            </div>
          </LazyLoad>
        ))}
      </div>
    </div>
  );
};

/**
 * Example 2: Lazy Loading Images
 * Demonstrates image lazy loading with custom placeholders
 */
export const LazyImageExample = () => {
  const images = Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    src: `https://picsum.photos/400/300?random=${i + 1}`,
    alt: `Random image ${i + 1}`
  }));

  return (
    <div className="lazy-image-demo">
      <h2>Image Lazy Loading Demo</h2>
      <p>Images load only when visible. Scroll up/down to test.</p>
      
      <div className="image-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '16px',
        padding: '20px'
      }}>
        {images.map((img) => (
          <div key={img.id} style={{
            height: '250px',
            position: 'relative',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <LazyLoadImage
              src={img.src}
              alt={img.alt}
              rootMargin="150px"
              threshold={0.01}
              onLoad={() => console.log(`Image ${img.id} loaded`)}
              onError={() => console.log(`Image ${img.id} failed`)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Example 3: Custom Placeholder
 * Shows how to use custom loading placeholders
 */
export const CustomPlaceholderExample = () => {
  const CustomLoadingPlaceholder = () => (
    <div style={{
      padding: '40px',
      textAlign: 'center',
      background: '#f8f9fa',
      borderRadius: '8px',
      border: '2px dashed #dee2e6'
    }}>
      <div className="spinner" style={{
        width: '40px',
        height: '40px',
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #3498db',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 12px'
      }} />
      <p style={{ margin: 0, color: '#6c757d' }}>Loading content...</p>
    </div>
  );

  return (
    <div className="custom-placeholder-demo">
      <h2>Custom Placeholder Demo</h2>
      
      {Array.from({ length: 10 }, (_, i) => (
        <LazyLoad
          key={i}
          placeholder={<CustomLoadingPlaceholder />}
          rootMargin="200px"
          threshold={0.1}
          minHeight="200px"
        >
          <div style={{
            background: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`,
            padding: '40px',
            borderRadius: '8px',
            color: 'white',
            marginBottom: '20px',
            minHeight: '200px'
          }}>
            <h3>Content Block {i + 1}</h3>
            <p>This content was lazy loaded with a custom placeholder!</p>
            <p>Loaded at: {new Date().toLocaleTimeString()}</p>
          </div>
        </LazyLoad>
      ))}
    </div>
  );
};

/**
 * Example 4: Integration with Weight/Nutrition Cards
 * Shows how to integrate with your existing components
 */
export const WeightCardLazyExample = ({ weightHistory }) => {
  return (
    <div className="weight-cards-lazy">
      {weightHistory.map((entry, index) => (
        <LazyLoad
          key={entry.ID}
          rootMargin="100px"
          threshold={0.1}
          minHeight="84px" // Match WeightCard height
          className="weight-card-lazy-wrapper"
          onVisibilityChange={(visible) => {
            // Optional: Track visibility for analytics
            if (visible) {
              console.log('Weight entry visible:', entry.ID);
            }
          }}
        >
          {/* Your existing WeightCard component */}
          <WeightCard
            data={entry}
            previousWeight={index > 0 ? weightHistory[index - 1].Weight : null}
            onDelete={handleDeleteEntry}
            onView={handleViewEntry}
            index={index}
          />
        </LazyLoad>
      ))}
    </div>
  );
};

// Demo component that combines all examples
const LazyLoadDemoPage = () => {
  const [activeDemo, setActiveDemo] = React.useState('cards');

  return (
    <div className="lazy-load-demos" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>LazyLoad Component Demos</h1>
      
      <div className="demo-selector" style={{ marginBottom: '30px' }}>
        <button 
          onClick={() => setActiveDemo('cards')}
          style={{ 
            padding: '10px 20px', 
            marginRight: '10px',
            background: activeDemo === 'cards' ? '#007bff' : '#f8f9fa',
            color: activeDemo === 'cards' ? 'white' : '#333',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Cards Demo
        </button>
        <button 
          onClick={() => setActiveDemo('images')}
          style={{ 
            padding: '10px 20px', 
            marginRight: '10px',
            background: activeDemo === 'images' ? '#007bff' : '#f8f9fa',
            color: activeDemo === 'images' ? 'white' : '#333',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Images Demo
        </button>
        <button 
          onClick={() => setActiveDemo('custom')}
          style={{ 
            padding: '10px 20px',
            background: activeDemo === 'custom' ? '#007bff' : '#f8f9fa',
            color: activeDemo === 'custom' ? 'white' : '#333',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Custom Placeholder
        </button>
      </div>

      {activeDemo === 'cards' && <LazyCardExample />}
      {activeDemo === 'images' && <LazyImageExample />}
      {activeDemo === 'custom' && <CustomPlaceholderExample />}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LazyLoadDemoPage;
