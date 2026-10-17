import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserCheck, LogOut, BookOpen, Receipt, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import PageContainer from '../../components/layout/PageContainer';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';

export default function CustomerDashboardPage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <PageContainer className="py-8">
      {/* Farmer Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-xs">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{user?.name}</h1>
              <Badge variant="default" size="sm">
                शेतकरी खाते
              </Badge>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              नोंदणीकृत मोबाईल: {user?.phone || 'N/A'}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          icon={LogOut}
          onClick={handleLogout}
          className="text-slate-700 hover:bg-slate-100"
        >
          Logout / बाहेर पडा
        </Button>
      </div>

      {/* Zero Data Leakage Security Notice */}
      <div className="p-4 rounded-xl bg-slate-100/80 border border-slate-200 text-slate-800 mb-8 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#166534] shrink-0 mt-0.5" />
        <div className="text-xs">
          <span className="font-bold block uppercase tracking-wide">
            सुरक्षित शेतकरी डिजिटल खातेवही (Data-Sandboxed)
          </span>
          <p className="text-slate-600 mt-0.5 leading-relaxed">
            हे पोर्टल केवळ आपल्या खात्याशी संबंधित माहितीसाठी मर्यादित आहे. अंतर्गत दुकान खर्च किंवा इतर शेतकऱ्यांच्या नोंदी येथे कधीही उपलब्ध नसतात.
          </p>
        </div>
      </div>

      {/* Passbook and Invoices Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-6 h-6 text-[#166534]" />
            <h2 className="text-base font-bold text-slate-900">
              खातेवही पासबुक (Khaata Passbook)
            </h2>
          </div>
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            आपली चालू बाकी उधारी शिल्लक आणि आजवर जमा केलेल्या रकमांचा तपशील टप्पा ६ (Milestone 6) मध्ये थेट दिसेल.
          </p>
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs font-semibold text-[#166534]">
            शिल्लक रक्कम: ₹०.०० (लेजर प्रणाली कार्यान्वित होत आहे)
          </div>
        </Card>

        <Card className="border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <Receipt className="w-6 h-6 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">
              खरेदी बिले व GST पावत्या (Invoices)
            </h2>
          </div>
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            काउंटरवर घेतलेल्या सर्व खते, बियाणे व औषधांची कर पावती व डाउनलोड पर्याय टप्पा ७ (Milestone 7) मध्ये उपलब्ध होईल.
          </p>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500">
            कोणतेही नवीन बिल उपलब्ध नाही
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
