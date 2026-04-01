import { Modal } from 'antd';
import { InfoCardMessage } from '@/types/chat';

type ProfileModalProps = {
  open: boolean;
  onClose: () => void;
  profileData: InfoCardMessage | null;
};

export function ProfileModal({ open, onClose, profileData }: ProfileModalProps) {
  if (!profileData) {
    return null;
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      className="profile-modal"
      styles={{
        content: {
          backgroundColor: '#0a0f1e',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
        body: {
          maxHeight: 'calc(90vh - 100px)',
          overflowY: 'auto',
          padding: '24px',
        },
        header: {
          backgroundColor: '#0a0f1e',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        },
      }}
      title={
        <div>
          <div className="text-xs uppercase tracking-[0.4em] text-green-300/70 mb-1">
            Информация
          </div>
          <h2 className="text-xl font-semibold text-white">{profileData.title}</h2>
        </div>
      }
    >
      <div className="space-y-4">
        {profileData.description && (
          <p className="text-sm text-slate-300">{profileData.description}</p>
        )}

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {profileData.cards.map((card) => (
            <div
              key={card.title}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 shadow-sm backdrop-blur min-h-[80px] flex flex-col"
            >
              <h3 className="text-xs font-semibold text-white mb-1.5 flex items-center gap-1.5">
                {card.icon && <span className="text-green-300 text-sm">{card.icon}</span>}
                <span className="break-words leading-tight">{card.title}</span>
              </h3>
              <p className="text-[11px] text-slate-300 leading-snug break-words flex-1 overflow-wrap-anywhere">{card.content}</p>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
