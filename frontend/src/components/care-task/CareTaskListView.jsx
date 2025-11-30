import React, { useState, useEffect } from 'react';

const CareTaskListView = ({ 
  tasks, 
  setShowAddForm, 
  handleEdit, 
  toggleActive, 
  handleDelete, 
  setShowScheduleFor,
  type = 'active' // 'active' or 'inactive'
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const renderTaskCard = (task) => (
    <div key={task.id} className="medication-card" style={{
      backgroundColor: '#fff',
      borderRadius: '8px',
      padding: isMobile ? '12px' : '16px',
      marginBottom: '12px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      border: `2px solid ${task.active ? '#28a745' : '#6c757d'}`
    }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: isMobile ? '12px' : '0' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#333', fontSize: isMobile ? '16px' : '18px', fontWeight: '600' }}>
            {task.name}
          </h4>
          {task.description && (
            <div style={{ marginBottom: '8px', fontSize: isMobile ? '13px' : '14px' }}>
              <span style={{ fontWeight: '500', color: '#666' }}>Description: </span>
              <span style={{ color: '#333' }}>{task.description}</span>
            </div>
          )}
          {task.group && (
            <div style={{ marginBottom: '8px', fontSize: isMobile ? '13px' : '14px' }}>
              <span style={{ fontWeight: '500', color: '#666' }}>Group: </span>
              <span style={{ color: '#333' }}>{task.group}</span>
            </div>
          )}
          {task.created_at && (
            <div style={{ fontSize: isMobile ? '12px' : '14px', color: '#666' }}>
              Created: {new Date(task.created_at).toLocaleDateString()}
            </div>
          )}
        </div>
        <div style={{ 
          display: 'flex', 
          gap: isMobile ? '6px' : '8px', 
          flexWrap: 'wrap',
          marginTop: isMobile ? '8px' : '0'
        }}>
          {/* Schedule button with indicator */}
          <button
            onClick={() => setShowScheduleFor(task.id)}
            style={{
              padding: isMobile ? '8px 12px' : '6px 12px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: task.schedules && task.schedules.length > 0 ? '#ffc107' : '#17a2b8',
              color: '#fff',
              cursor: 'pointer',
              fontSize: isMobile ? '13px' : '12px',
              position: 'relative',
              flex: isMobile ? '1 1 calc(50% - 3px)' : '0 0 auto',
              minWidth: isMobile ? '0' : 'auto'
            }}
          >
            Schedule
            {task.schedules && task.schedules.length > 0 && (
              <span style={{
                display: 'inline-block',
                marginLeft: 6,
                background: '#28a745',
                color: '#fff',
                borderRadius: '50%',
                width: 16,
                height: 16,
                fontSize: 11,
                lineHeight: '16px',
                textAlign: 'center',
                fontWeight: 700
              }}>{task.schedules.length}</span>
            )}
          </button>
          <button
            onClick={() => handleEdit(task)}
            style={{
              padding: isMobile ? '8px 12px' : '6px 12px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: '#007bff',
              color: '#fff',
              cursor: 'pointer',
              fontSize: isMobile ? '13px' : '12px',
              flex: isMobile ? '1 1 calc(50% - 3px)' : '0 0 auto'
            }}
          >
            Edit
          </button>
          <button
            onClick={() => toggleActive(task.id)}
            style={{
              padding: isMobile ? '8px 12px' : '6px 12px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: task.active ? '#6c757d' : '#28a745',
              color: '#fff',
              cursor: 'pointer',
              fontSize: isMobile ? '13px' : '12px',
              flex: isMobile ? '1 1 calc(50% - 3px)' : '0 0 auto'
            }}
          >
            {task.active ? 'Pause' : 'Resume'}
          </button>
          <button
            onClick={() => handleDelete(task.id)}
            style={{
              padding: isMobile ? '8px 12px' : '6px 12px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: '#dc3545',
              color: '#fff',
              cursor: 'pointer',
              fontSize: isMobile ? '13px' : '12px',
              flex: isMobile ? '1 1 calc(50% - 3px)' : '0 0 auto'
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );

  if (tasks.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '40px',
        color: '#666',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <p>No {type} care tasks found.</p>
        {type === 'active' && (
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: '#007bff',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '14px',
              marginTop: '10px'
            }}
          >
            Add your first care task
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {tasks.map(renderTaskCard)}
    </div>
  );
};

export default CareTaskListView;
