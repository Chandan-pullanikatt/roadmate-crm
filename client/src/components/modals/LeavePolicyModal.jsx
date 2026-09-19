import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal, Button } from '../ui';
import { leaveApi } from '../../api/leaveApi';
import { DocumentBody } from '../../pages/industry-manager/components/SopViewer';

/** Shows the leave policy document the founder uploaded. */
const LeavePolicyModal = ({ isOpen, onClose }) => {
  const { data: policyDoc, isLoading, isError } = useQuery({
    queryKey: ['leave-policy-document'],
    queryFn: () => leaveApi.getPolicyDocument().then(res => res.data),
    enabled: isOpen,
    // The view URL expires after an hour, so don't hold on to it for long.
    staleTime: 10 * 60 * 1000,
  });

  return (
    <Modal
      isOpen={isOpen}
      title="Leave Policy · RoadMate Team"
      subtitle={policyDoc ? policyDoc.fileName : 'Company leave policy'}
      onClose={onClose}
      className="modal-lg"
    >
      {isLoading ? (
        <div className="py-16 text-center text-text-muted text-[14px] font-bold">Loading leave policy…</div>
      ) : isError ? (
        <div className="py-16 text-center text-text-muted text-[14px] font-bold">Unable to load the leave policy. Please try again.</div>
      ) : !policyDoc ? (
        <div className="py-16 text-center">
          <div className="text-4xl mb-3 opacity-30">📜</div>
          <div className="text-text-muted text-[14px] font-bold">The leave policy hasn't been uploaded yet.</div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/40 overflow-hidden">
            <DocumentBody doc={{ ...policyDoc, _id: policyDoc.fileKey }} />
          </div>
          <div className="flex justify-between items-center">
            <a
              href={policyDoc.viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-bold text-purple hover:underline"
            >
              Open in new tab ↗
            </a>
            <Button variant="primary" onClick={onClose} className="px-8">Close</Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default LeavePolicyModal;
