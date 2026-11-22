import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Sparkles,
  X,
  FileText,
  ArrowRight,
  Package,
} from 'lucide-react';
import { MerchantProductItem } from '../types';

interface BulkProductUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProducts: (newProducts: MerchantProductItem[]) => void;
  businessName?: string;
}

interface ParsedRow {
  id: string;
  name: string;
  category: 'Beverages' | 'Desserts' | 'Snacks' | 'Fuel' | 'Groceries';
  price: number;
  originalPrice?: number;
  stock: number;
  unit?: string;
  description?: string;
  status: 'Active';
  isValid: boolean;
  error?: string;
}

const SAMPLE_CSV = `Product Name,Category,Price,MRP,Stock,Unit,Description
Amul Gold Milk 500ml,Groceries,33,34,50,Pouch,Fresh pasteurized full cream milk
Tata Salt 1kg,Groceries,28,30,100,Packet,Vacuum evaporated iodized salt
Fortune Sunlite Refined Oil 1L,Groceries,145,165,40,Pouch,Refined sunflower edible cooking oil
Aashirvaad Shudh Chakki Atta 5kg,Groceries,235,260,30,Bag,100% whole wheat flour
Haldiram's Bhujia Sev 400g,Snacks,110,120,60,Packet,Crispy spicy gram flour noodles
Tata Tea Premium 500g,Beverages,280,310,45,Packet,Desh ki Chai blended tea leaves
Cadbury Dairy Milk Silk 60g,Desserts,85,90,75,Bar,Smooth creamy chocolate bar
Kurkure Masala Munch 90g,Snacks,20,20,120,Packet,Crispy puffed corn snack`;

export const BulkProductUploadModal: React.FC<BulkProductUploadModalProps> = ({
  isOpen,
  onClose,
  onAddProducts,
  businessName,
}) => {
  const [activeMode, setActiveMode] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'MyArea24_Store_Inventory_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const mapCategory = (raw: string): 'Beverages' | 'Desserts' | 'Snacks' | 'Fuel' | 'Groceries' => {
    const s = (raw || '').toLowerCase().trim();
    if (s.includes('bev') || s.includes('tea') || s.includes('coffee') || s.includes('juice') || s.includes('drink')) {
      return 'Beverages';
    }
    if (s.includes('dessert') || s.includes('sweet') || s.includes('cake') || s.includes('chocolate') || s.includes('ice cream')) {
      return 'Desserts';
    }
    if (s.includes('snack') || s.includes('namkeen') || s.includes('chips') || s.includes('biscuit') || s.includes('cookie')) {
      return 'Snacks';
    }
    if (s.includes('fuel') || s.includes('petrol') || s.includes('diesel') || s.includes('cng')) {
      return 'Fuel';
    }
    return 'Groceries';
  };

  const parseCsvContent = (content: string) => {
    setUploadError(null);
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      setUploadError('CSV must contain a header row and at least 1 product row.');
      return;
    }

    const headers = lines[0].split(',').map((h) => h.toLowerCase().trim().replace(/['"]/g, ''));
    const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('product') || h.includes('item'));
    const catIdx = headers.findIndex((h) => h.includes('category') || h.includes('type'));
    const priceIdx = headers.findIndex((h) => h.includes('price') || h.includes('rate') || h.includes('sp'));
    const mrpIdx = headers.findIndex((h) => h.includes('mrp') || h.includes('original'));
    const stockIdx = headers.findIndex((h) => h.includes('stock') || h.includes('qty') || h.includes('quantity'));
    const unitIdx = headers.findIndex((h) => h.includes('unit') || h.includes('pack'));
    const descIdx = headers.findIndex((h) => h.includes('desc') || h.includes('detail'));

    if (nameIdx === -1 || priceIdx === -1) {
      setUploadError('CSV header must include at least "Product Name" and "Price" columns.');
      return;
    }

    const results: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      // Split on comma taking quotes into account
      const rawCols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
      const cols = rawCols.map((c) => c.replace(/^["']|["']$/g, '').trim());

      const rawName = cols[nameIdx] || '';
      const rawPrice = parseFloat(cols[priceIdx] || '0');
      const rawMrp = mrpIdx !== -1 ? parseFloat(cols[mrpIdx] || '0') : undefined;
      const rawStock = stockIdx !== -1 ? parseInt(cols[stockIdx] || '50', 10) : 50;
      const rawCat = catIdx !== -1 ? cols[catIdx] : 'Groceries';
      const rawUnit = unitIdx !== -1 ? cols[unitIdx] : 'Unit';
      const rawDesc = descIdx !== -1 ? cols[descIdx] : '';

      const isValid = Boolean(rawName && !isNaN(rawPrice) && rawPrice > 0);

      results.push({
        id: `bulk-${Date.now()}-${i}`,
        name: rawName || `Unnamed Product #${i}`,
        category: mapCategory(rawCat),
        price: !isNaN(rawPrice) && rawPrice > 0 ? rawPrice : 100,
        originalPrice: rawMrp && rawMrp > rawPrice ? rawMrp : undefined,
        stock: !isNaN(rawStock) ? rawStock : 50,
        unit: rawUnit,
        description: rawDesc || `Fresh ${rawName} in store stock`,
        status: 'Active',
        isValid,
        error: !isValid ? 'Name or Price missing' : undefined,
      });
    }

    setParsedRows(results);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        parseCsvContent(text);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        parseCsvContent(text);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmUpload = () => {
    const validOnes = parsedRows.filter((r) => r.isValid);
    if (validOnes.length === 0) {
      setUploadError('No valid products to import.');
      return;
    }

    setIsProcessing(true);

    const converted: MerchantProductItem[] = validOnes.map((v) => ({
      id: v.id,
      name: v.name,
      category: v.category,
      price: v.price,
      originalPrice: v.originalPrice,
      status: 'Active',
      views: 1,
      enquiries: 0,
      image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400',
      description: v.description,
    }));

    setTimeout(() => {
      onAddProducts(converted);
      setIsProcessing(false);
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
        setIsSuccess(false);
        setParsedRows([]);
        setFileName(null);
      }, 1500);
    }, 600);
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Bulk Inventory Upload (Excel / CSV)
              </h3>
              <p className="text-xs text-slate-500">
                Publish up to 500+ items to {businessName || 'your live storefront'} in 2 minutes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Download Template & Tab Toggle */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-3.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-900 font-semibold">
                Use our standard CSV/Excel format for 1-click parsing.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 rounded-xl bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Download Template (.csv)</span>
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setActiveMode('upload')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeMode === 'upload'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload CSV / Excel</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('paste')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeMode === 'paste'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Paste Text / Copy-Paste</span>
            </button>
          </div>

          {/* Mode 1: File Dropzone */}
          {activeMode === 'upload' && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-purple-500 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-50/50 hover:bg-purple-50/30"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.tsv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <div className="w-12 h-12 rounded-2xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-600 mb-2">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">
                {fileName ? `Selected: ${fileName}` : 'Click to upload or drag & drop CSV file'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Supports UTF-8 CSV, TXT (up to 5MB)</p>
            </div>
          )}

          {/* Mode 2: Paste Raw CSV */}
          {activeMode === 'paste' && (
            <div className="space-y-2">
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={SAMPLE_CSV}
                rows={6}
                className="w-full p-3 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-purple-600"
              />
              <button
                type="button"
                onClick={() => parseCsvContent(pastedText)}
                className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition"
              >
                Parse Pasted CSV
              </button>
            </div>
          )}

          {/* Error Message */}
          {uploadError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Parsed Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold text-slate-800">
                  Preview ({validCount} valid / {parsedRows.length} total rows parsed)
                </p>
                <button
                  type="button"
                  onClick={() => setParsedRows([])}
                  className="text-xs text-rose-600 hover:underline flex items-center gap-1 font-bold"
                >
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                    <tr>
                      <th className="p-2.5">Item Name</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Price</th>
                      <th className="p-2.5">MRP</th>
                      <th className="p-2.5">Stock</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((r, idx) => (
                      <tr key={idx} className={r.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50'}>
                        <td className="p-2.5 font-bold text-slate-900">{r.name}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
                            {r.category}
                          </span>
                        </td>
                        <td className="p-2.5 font-extrabold text-emerald-600">₹{r.price}</td>
                        <td className="p-2.5 text-slate-400 line-through">
                          {r.originalPrice ? `₹${r.originalPrice}` : '—'}
                        </td>
                        <td className="p-2.5 font-bold text-slate-700">{r.stock}</td>
                        <td className="p-2.5">
                          {r.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
                              <AlertCircle className="w-3.5 h-3.5" /> {r.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {isSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-xs font-bold">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-extrabold">All Products Added Successfully!</p>
                <p className="font-medium text-emerald-700">
                  Your store inventory has been published and is now searchable by neighborhood residents.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/70">
          <p className="text-xs text-slate-500">
            {validCount > 0 ? `${validCount} items ready to import` : 'Select a file to begin'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={validCount === 0 || isProcessing}
              onClick={handleConfirmUpload}
              className={`px-5 py-2 rounded-xl text-xs font-extrabold text-white flex items-center gap-1.5 transition shadow-xs cursor-pointer ${
                validCount === 0 || isProcessing
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isProcessing ? (
                <span>Importing...</span>
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  <span>Import {validCount} Products to Store</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
