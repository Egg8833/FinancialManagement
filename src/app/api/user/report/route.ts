export const maxDuration = 30;

import { auth } from '../../../../auth';
import { getDb } from '../../../../db/client';
import { computeUserReport } from '../../../../server/reportEngine';
import { sendEmail } from '../../../../lib/mail';
import { handleSendReport } from '../../../../server/sendReport';

export const POST = () => handleSendReport({
  getSessionUser: async () => {
    const session = await auth();
    return session?.user?.id ? { id: session.user.id, email: session.user.email } : null;
  },
  getDb,
  computeUserReport,
  sendEmail,
  smtpConfigured: () => !!(process.env.EMAIL_SERVER_HOST && process.env.EMAIL_SERVER_USER),
});
