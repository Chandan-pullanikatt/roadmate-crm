import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { Button } from '../../../components/ui';

const CreateExecutive = ({ onCancel }) => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('open-modal', {
      detail: {
        type: 'create-exec',
        role: 'executive',
        prefill: {
          reportingTo: currentUser?._id,
          state: currentUser?.state,
          industry: currentUser?.industry
        }
      }
    }));
  }, []);

  const handleBack = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate('?page=team');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <p className="text-sm text-text-muted font-medium">Use the form above to create a new executive account.</p>
      <Button variant="outline" className="rounded-xl px-8 font-bold text-[10px] uppercase tracking-widest" onClick={handleBack}>
        ← Back to Team
      </Button>
    </div>
  );
};

export default CreateExecutive;
