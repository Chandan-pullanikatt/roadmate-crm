import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '../../../api/attendanceApi';
import { usersApi } from '../../../api/usersApi';
import { Button, Modal, Avatar, Tag } from '../../../components/ui';
import { useToast } from '../../../context/ToastContext';

const Attendance = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [viewDate, setViewDate] = useState(new Date());
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const month = viewDate.getMonth() + 1;
  const year = viewDate.getFullYear();

  const { data: executives, isLoading: usersLoading } = useQuery({
    queryKey: ['users', 'executives'],
    queryFn: () => usersApi.getUsers({ role: 'executive' }).then(res => res.data)
  });

  const { data: attendanceList, isLoading: attLoading } = useQuery({
    queryKey: ['attendance', 'im-grid', month, year],
    queryFn: () => attendanceApi.getAttendance({ month, year }).then(res => res.data)
  });

  const editMutation = useMutation({
    mutationFn: (data) => attendanceApi.editAttendance(data.id, { status: data.status, note: data.note }),
    onSuccess: () => {
      queryClient.invalidateQueries(['attendance', 'im-grid']);
      setIsEditModalOpen(false);
      addToast("Attendance updated", "success");
    },
    onError: (err) => {
      addToast(err.response?.data?.message || "Update failed", "error");
    }
  });

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const prevMonth = () => setViewDate(new Date(year, month - 2, 1));
  const nextMonth = () => setViewDate(new Date(year, month, 1));

  // Transform attendance into lookup: { userId_day: record }
  const attendanceLookup = {};
  attendanceList?.forEach(rec => {
    const d = new Date(rec.date).getDate();
    attendanceLookup[`${rec.user._id}_${d}`] = rec;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return 'bg-accent/80';
      case 'half-day': return 'bg-amber';
      case 'absent': return 'bg-red/80';
      case 'leave': return 'bg-blue';
      default: return 'bg-surface2';
    }
  };

  const handleCellClick = (exec, day) => {
    const record = attendanceLookup[`${exec._id}_${day}`];
    if (!record) return;
    setSelectedRecord({ 
      ...record, 
      execName: exec.name, 
      day,
      dateFormatted: `${day} ${monthNames[month - 1]} ${year}`
    });
    setIsEditModalOpen(true);
  };

  const exportRegister = () => {
    if (!executives || !attendanceList) return;
    const headers = ['Executive', ...days.map(d => d.toString())];
    const rows = executives.map(exec => {
      const row = [exec.name];
      days.forEach(d => {
        const rec = attendanceLookup[`${exec._id}_${d}`];
        row.push(rec?.status || '-');
      });
      return row;
    });
    const csv = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `attendance-${month}-${year}.csv`; a.click();
    addToast("Exporting register", "success");
  };

  if (usersLoading || attLoading) return <div className="p-8 text-center text-text-muted">Loading attendance grid...</div>;

  return (
    <div className="space-y-6 animate-in slide-in-from-right-10 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-text-primary tracking-tight">Team Attendance Grid</h2>
          <p className="text-sm text-text-muted">{monthNames[month - 1]} {year} · State Level Monitoring</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex gap-1">
            <button className="btn btn-outline btn-xs" onClick={prevMonth}>←</button>
            <button className="btn btn-outline btn-xs" onClick={nextMonth}>→</button>
          </div>
          <div className="flex gap-2 text-[10px] font-bold text-text-muted uppercase hidden md:flex">
             <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-accent/80"></span> Present</div>
             <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber"></span> Half</div>
             <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red/80"></span> Absent</div>
             <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue"></span> Leave</div>
          </div>
          <Button variant="outline" size="sm" onClick={exportRegister}>Export Register</Button>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border shadow-default overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface2/50 text-[10px] font-bold text-text-muted uppercase">
                <th className="sticky left-0 bg-surface z-10 px-4 py-3 text-left w-64 border-b border-border shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Executive Name</th>
                {days.map(d => (
                  <th key={d} className="px-1 py-3 text-center border-b border-border min-w-[30px]">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {executives?.map(exec => (
                <tr key={exec._id} className="hover:bg-surface2/20 transition-colors">
                  <td className="sticky left-0 bg-surface z-10 px-4 py-3 border-r border-border shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-3">
                       <Avatar name={exec.name} size="xs" />
                       <span className="text-xs font-bold text-text-primary whitespace-nowrap">{exec.name}</span>
                    </div>
                  </td>
                  {days.map(d => {
                    const record = attendanceLookup[`${exec._id}_${d}`];
                    return (
                      <td key={d} className="p-0.5 border-r border-border">
                        <div 
                          onClick={() => handleCellClick(exec, d)}
                          className={`w-full h-8 rounded-md cursor-pointer transition-transform hover:scale-110 ${getStatusColor(record?.status)}`}
                          title={record ? `${record.status}: ${record.workPercentage || 0}% work` : 'No record'}
                        ></div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isEditModalOpen && (
        <Modal
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Attendance Record"
          subtitle={`${selectedRecord?.execName} — ${selectedRecord?.dateFormatted}`}
        >
          <div className="space-y-6 pt-2">
             <div className="grid grid-cols-2 gap-3">
                {['present', 'half-day', 'absent', 'leave'].map(s => (
                  <div 
                    key={s}
                    onClick={() => editMutation.mutate({ id: selectedRecord._id, status: s })}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col items-center gap-2 ${selectedRecord?.status === s ? 'border-accent bg-accent-light' : 'border-border hover:border-accent/40'}`}
                  >
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${getStatusColor(s)} text-white`}>
                       {s[0].toUpperCase()}
                     </div>
                     <span className="text-xs font-bold uppercase tracking-widest">{s.replace('-', ' ')}</span>
                  </div>
                ))}
             </div>
             <div className="pt-4 flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
             </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Attendance;
