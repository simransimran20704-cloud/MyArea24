import React, { useState } from 'react';
import {
  X,
  Shield,
  RotateCcw,
  FileText,
  Lock,
  Mail,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Building2,
  ExternalLink,
} from 'lucide-react';

export type CompliancePolicyTab = 'grievance' | 'cancellation' | 'terms' | 'privacy';

interface CompliancePolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: CompliancePolicyTab;
}

export const CompliancePolicyModal: React.FC<CompliancePolicyModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'grievance',
}) => {
  const [activeTab, setActiveTab] = useState<CompliancePolicyTab>(initialTab);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compliance-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 id="compliance-modal-title" className="text-base font-extrabold tracking-tight">
                Indian Commerce & Consumer Protection Disclosures
              </h2>
              <p className="text-[11px] text-slate-300">
                Consumer Protection (E-Commerce) Rules 2020 • DPDP Act 2023 • Legal Metrology
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50/80 px-4 overflow-x-auto no-scrollbar gap-1 pt-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('grievance')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'grievance'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-4 h-4 text-indigo-600" />
            <span>Grievance Officer</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cancellation')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'cancellation'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-emerald-600" />
            <span>Return & Cancellation (15-min)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'terms'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-600" />
            <span>Terms of Service</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'privacy'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-4 h-4 text-purple-600" />
            <span>Privacy Policy (DPDP)</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-slate-700 text-xs sm:text-sm leading-relaxed">
          {/* TAB 1: GRIEVANCE REDRESSAL OFFICER */}
          {activeTab === 'grievance' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/60">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-indigo-600 text-white mt-0.5">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                      Mandatory Grievance Redressal Mechanism
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      In compliance with Rule 4(4) and Rule 5(3)(b) of the Consumer Protection (E-Commerce) Rules,
                      2020 and Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules,
                      2021.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-700">
                    <Building2 className="w-4 h-4" />
                    Designated Grievance Officer
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Officer Name:</span>
                      <strong className="text-slate-800 font-bold">Shri Rajesh K. Sharma</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Designation:</span>
                      <span className="text-slate-800">Head of Regulatory Affairs & Grievance Officer</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Entity Name:</span>
                      <span className="text-slate-800">MyArea24 Technologies India Pvt. Ltd.</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">CIN:</span>
                      <span className="font-mono text-slate-700">U72900HR2024PTC118920</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2 text-xs uppercase tracking-wider text-emerald-700">
                    <Mail className="w-4 h-4" />
                    Contact & Redressal Timelines
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <a href="mailto:grievance@myarea24.in" className="text-indigo-600 font-bold hover:underline">
                        grievance@myarea24.in
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-slate-800 font-medium">+91 124 4920024 / 1800 240 2424</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="text-slate-600 text-[11px]">
                        DLF Cyber City, Sector 24, Gurugram, Haryana – 122002, India
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-slate-600 text-[11px]">Mon–Sat: 09:30 AM – 06:30 PM IST</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Statutory SLA Benchmarks */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Statutory Redressal Standards (E-Commerce Rules 2020)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-start gap-2 bg-white p-3 rounded-xl border border-slate-200/80">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-slate-900 font-bold">48-Hour Acknowledgement</strong>
                      <span className="text-slate-600 text-[11px]">
                        Every consumer complaint receives an automated ticket number within 48 hours.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 bg-white p-3 rounded-xl border border-slate-200/80">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-slate-900 font-bold">30-Day Complete Resolution</strong>
                      <span className="text-slate-600 text-[11px]">
                        Investigation and resolution are finalized within one month from ticket generation.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RETURN & CANCELLATION POLICY (15-MIN PERISHABLE WINDOW) */}
          {activeTab === 'cancellation' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/60 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-emerald-600 text-white mt-0.5">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                    Return, Refund & 15-Minute Cancellation Policy
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Governed by the Consumer Protection Act, 2019 and Consumer Protection (E-Commerce) Rules, 2020.
                  </p>
                </div>
              </div>

              {/* 15-Minute Cancellation Window Notice */}
              <div className="p-4 rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/30 space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <span>15-Minute Perishable Cancellation Window</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  For fresh food, dairy, bakery, and fresh agricultural produce sourced from local neighbourhood
                  stores, customers enjoy a <strong>15-minute grace cancellation window</strong> after order placement
                  with 100% full refund.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2.5 rounded-xl bg-white border border-emerald-200 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900">Within 15 Minutes:</strong>
                      <p className="text-slate-600 text-[11px]">
                        Instant 100% refund initiated back to your original payment method.
                      </p>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-amber-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900">After 15 Minutes:</strong>
                      <p className="text-slate-600 text-[11px]">
                        Subject to merchant preparation status to prevent perishable inventory spoilage.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Non-perishable returns */}
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Packaged & Non-Perishable Goods (Groceries, Electronics, Stationery)
                </h4>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li>
                    <strong>24–48 Hour Return Window:</strong> Customers may request a replacement or return within
                    48 hours of delivery if items are received broken, expired, defective, or incorrect.
                  </li>
                  <li>
                    <strong>Hassle-Free Inspection:</strong> Neighborhood delivery partner collects the item from your
                    doorstep upon visual verification of batch number / seal.
                  </li>
                  <li>
                    <strong>Zero Cancellation Fee:</strong> No arbitrary cancellation or processing penalties are
                    deducted pursuant to Rule 6(4)(a) of the E-Commerce Rules 2020.
                  </li>
                  <li>
                    <strong>Refund Timelines:</strong> UPI and wallet refunds reflect in <strong>2 to 4 business hours</strong>;
                    debit/credit card refunds credit in <strong>3 to 5 banking days</strong> as per RBI/NPCI guidelines.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: TERMS OF SERVICE */}
          {activeTab === 'terms' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/60 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-600 text-white mt-0.5">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                    Platform Terms of Service & Intermediary Guidelines
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Published pursuant to Section 79 of the Information Technology Act, 2000.
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-slate-700 leading-relaxed">
                <p>
                  <strong>1. Intermediary Role:</strong> MyArea24 operates as a pure technology marketplace connecting
                  verified local neighbourhood businesses (merchants, pharmacies, kirana stores) with neighbourhood
                  residents.
                </p>
                <p>
                  <strong>2. Fair Pricing & Legal Metrology:</strong> All prices displayed on MyArea24 are Maximum
                  Retail Price (MRP) compliant and Inclusive of All Taxes (GST). Merchants are legally obligated to
                  furnish genuine weights, expiry dates, and country of origin declarations under the Legal Metrology
                  (Packaged Commodities) Rules, 2011.
                </p>
                <p>
                  <strong>3. Distance-Tiered Delivery Transparency:</strong> Delivery fees are strictly calculated via
                  geodesic distance matrices (₹20 for &le;2km, ₹30 for &le;4km, +₹10/km thereafter) with 100% transparency
                  prior to checkout.
                </p>
                <p>
                  <strong>4. Prohibition of Unfair Trade Practices:</strong> MyArea24 does not engage in algorithmic
                  price distortion, predatory bias, or discriminatory ranking of local retailers.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: PRIVACY POLICY & DPDP ACT 2023 */}
          {activeTab === 'privacy' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200/60 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-purple-600 text-white mt-0.5">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                    Privacy Policy & Digital Personal Data Protection (DPDP) Act 2023
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Your personal information is encrypted in transit and at rest per Indian cybersecurity regulations.
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-slate-700 leading-relaxed">
                <p>
                  <strong>1. Purpose Limitation:</strong> Your location coordinates and contact numbers are used
                  strictly to compute hyper-local air quality indices, local weather forecasts, and deliver store orders. We
                  never sell user data to advertising brokers.
                </p>
                <p>
                  <strong>2. Customer Phone Masking:</strong> When merchants or delivery riders contact you, phone
                  numbers can be masked or routed via verified transactional channels to protect personal privacy.
                </p>
                <p>
                  <strong>3. Right to Erasure:</strong> Users maintain the statutory right to request erasure of their
                  account, order history, and saved addresses by writing to{' '}
                  <a href="mailto:privacy@myarea24.in" className="text-indigo-600 font-bold hover:underline">
                    privacy@myarea24.in
                  </a>
                  .
                </p>
                <p>
                  <strong>4. Data Residency:</strong> All primary databases and backup instances reside in ISO 27001
                  certified cloud data centers within the sovereign territory of the Republic of India.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-medium">
            Government of India e-Commerce Compliance • v2.4 (2026)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
          >
            Close Disclosure
          </button>
        </div>
      </div>
    </div>
  );
};
