import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { MFAService, type MFAEnrollmentResponse } from '@/services/mfa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Firewall } from '@/utils/firewall';

interface MFAEnrollmentProps {
    isOpen: boolean;
    onClose: () => void;
    onEnrolled: () => void;
}

export const MFAEnrollment: React.FC<MFAEnrollmentProps> = ({ isOpen, onClose, onEnrolled }) => {
    const [step, setStep] = useState<'loading' | 'scan' | 'verify'>('loading');
    const [enrollmentData, setEnrollmentData] = useState<MFAEnrollmentResponse | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
    const [verifyCode, setVerifyCode] = useState('');
    const [verifying, setVerifying] = useState(false);

    useEffect(() => {
        if (isOpen) {
            startEnrollment();
        } else {
            // Reset state on close
            setStep('loading');
            setEnrollmentData(null);
            setVerifyCode('');
        }
    }, [isOpen]);

    const startEnrollment = async () => {
        try {
            if (!Firewall.checkRateLimit('mfa_enroll')) {
                toast({ title: "Security Alert", description: "Too many attempts. Please wait.", variant: "destructive" });
                onClose();
                return;
            }

            const data = await MFAService.enroll();
            setEnrollmentData(data);
            
            // Generate QR Code
            const url = await QRCode.toDataURL(data.totp.uri);
            setQrCodeUrl(url);
            setStep('scan');
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'Failed to start 2FA enrollment', variant: 'destructive' });
            onClose();
        }
    };

    const handleVerify = async () => {
        if (!enrollmentData) return;
        if (verifyCode.length !== 6) {
            toast({ title: 'Invalid Code', description: 'Code must be 6 digits', variant: 'destructive' });
            return;
        }

        if (!Firewall.inspect(verifyCode)) {
            Firewall.logEvent('CRITICAL', 'Malicious payload in MFA code input');
            return;
        }

        setVerifying(true);
        try {
            await MFAService.verify(enrollmentData.id, verifyCode, enrollmentData.totp.secret);
            toast({ title: 'Success', description: 'Two-Factor Authentication Enabled!' });
            onEnrolled();
            onClose();
        } catch (error: any) {
            console.error(error);
            const msg = error?.message || 'Invalid code. Please try again.';
            toast({ title: 'Verification Failed', description: msg, variant: 'destructive' });
        } finally {
            setVerifying(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-primary" />
                        Setup Two-Factor Authentication
                    </DialogTitle>
                    <DialogDescription>
                        Secure your account with 2FA using an authenticator app.
                    </DialogDescription>
                </DialogHeader>

                {step === 'loading' && (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                )}

                {step === 'scan' && enrollmentData && (
                    <div className="space-y-4 py-4">
                        <div className="flex justify-center bg-white p-4 rounded-lg">
                            {qrCodeUrl && <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />}
                        </div>
                        
                        <div className="text-sm text-center text-muted-foreground">
                            <p>Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
                            <p className="mt-2 text-xs font-mono bg-muted p-2 rounded select-all">
                                Secret: {enrollmentData.totp.secret}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Verify Code</label>
                            <div className="flex gap-2">
                                <Input 
                                    value={verifyCode}
                                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="000000"
                                    className="text-center text-lg tracking-widest"
                                />
                                <Button onClick={handleVerify} disabled={verifying || verifyCode.length !== 6}>
                                    {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
