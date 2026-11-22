import React, { useState } from 'react';
import {
  Shield,
  RotateCcw,
  FileText,
  Lock,
  Scale,
  Award,
  CheckCircle,
  Building2,
  Mail,
  Phone,
} from 'lucide-react';
import { CompliancePolicyModal, CompliancePolicyTab } from './CompliancePolicyModal';

interface ComplianceFooterProps {
  className?: string;
}

export const ComplianceFooter: React.FC<ComplianceFooterProps> = ({ className = '' }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CompliancePolicyTab>('grievance');

  const handleOpenPolicy = (tab: CompliancePolicyTab) => {
    setActiveTab(tab);
    setModalOpen(true);
  };

  return (
    <>
      <footer
        role="contentinfo"
        aria-label="Consumer Protection and Regulatory Compliance Footer"
        className={`mt-12 pt-8 pb-14 border-t border-slate-200/80 bg-white/60 backdrop-blur-xs text-slate-600 ${className}`}
      >
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 space-y-6">
          {/* Top Trust & Compliance Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-6 border-b border-slate-200/80">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Scale className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="block font-semibold text-xs text-slate-900 leading-tight">E-Commerce Rules</span>
                <span className="block text-[10px] text-slate-500">2020 Consumer Protection</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <RotateCcw className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="block font-semibold text-xs text-slate-900 leading-tight">15-Min Cancellation</span>
                <span className="block text-[10px] text-slate-500">Perishables & Fresh Food</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="block font-semibold text-xs text-slate-900 leading-tight">Grievance Redressal</span>
                <span className="block text-[10px] text-slate-500">48-Hr Acknowledgment SLA</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="block font-semibold text-xs text-slate-900 leading-tight">FSSAI & DPDP 2023</span>
                <span className="block text-[10px] text-slate-500">Food Safety & Data Privacy</span>
              </div>
            </div>
          </div>

          {/* Links & Legal Disclosures Grid */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 text-sm tracking-tight">MyArea24</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 font-bold">
                  Hyperlocal Intermediary
                </span>
              </div>
              <p className="text-[11px] text-slate-500 max-w-xl leading-relaxed">
                Empowering neighbourhood stores, pharmacies, and residents with verified local intelligence,
                transparent distance-tiered delivery, and real-time civic updates across India.
              </p>
            </div>

            {/* Mandatory Statutory Links */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-slate-700">
              <button
                type="button"
                onClick={() => handleOpenPolicy('grievance')}
                className="hover:text-indigo-600 transition flex items-center gap-1 cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                <span>Grievance Officer</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenPolicy('cancellation')}
                className="hover:text-emerald-600 transition flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                <span>Return & Cancellation Policy</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenPolicy('terms')}
                className="hover:text-amber-600 transition flex items-center gap-1 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                <span>Terms of Service</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenPolicy('privacy')}
                className="hover:text-purple-600 transition flex items-center gap-1 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-purple-600" />
                <span>Privacy Policy</span>
              </button>

              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('myarea24_open_consent_preferences'))}
                className="hover:text-indigo-600 transition flex items-center gap-1 cursor-pointer"
                title="Manage DPDP Act 2023 Consent and Exercise Right to Erasure"
              >
                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                <span>Consent & Privacy Choices</span>
              </button>
            </div>
          </div>

          {/* Bottom Copyright & Regulatory Footnote */}
          <div className="pt-4 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-400">
            <span>
              &copy; {new Date().getFullYear()} MyArea24 Technologies India Pvt. Ltd. (CIN: U72900HR2024PTC118920).
              All rights reserved.
            </span>
            <div className="flex items-center gap-3">
              <span>Consumer Affairs Toll-Free: 1800 240 2424</span>
              <span>•</span>
              <a href="mailto:grievance@myarea24.in" className="text-slate-500 hover:text-slate-800 transition">
                grievance@myarea24.in
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Interactive Policy Modal */}
      <CompliancePolicyModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialTab={activeTab}
      />
    </>
  );
};
