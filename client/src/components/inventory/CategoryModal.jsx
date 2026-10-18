import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, FolderPlus, AlertCircle, Save } from 'lucide-react';
import Button from '../common/Button';

export default function CategoryModal({
  isOpen,
  onClose,
  onSubmit,
  category = null,
  categories = [],
}) {
  const { t } = useTranslation();
  const isEdit = Boolean(category);

  const [formData, setFormData] = useState({
    nameEn: '',
    nameMr: '',
    slug: '',
    parentId: '',
    active: true,
  });

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (category) {
      setFormData({
        nameEn: category.nameEn || '',
        nameMr: category.nameMr || '',
        slug: category.slug || '',
        parentId: typeof category.parentId === 'object' ? category.parentId?._id : (category.parentId || ''),
        active: category.active !== undefined ? category.active : true,
      });
    } else {
      setFormData({
        nameEn: '',
        nameMr: '',
        slug: '',
        parentId: '',
        active: true,
      });
    }
    setError('');
  }, [category, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleNameEnChange = (e) => {
    const val = e.target.value;
    setFormData((prev) => ({
      ...prev,
      nameEn: val,
      // Auto-generate slug if not editing or if slug was empty
      slug: !isEdit
        ? val
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]+/g, '')
        : prev.slug,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.nameEn.trim()) {
      setError('Category English name is required');
      return;
    }
    if (!formData.nameMr.trim()) {
      setError('Category Marathi name is required');
      return;
    }

    const payload = {
      nameEn: formData.nameEn.trim(),
      nameMr: formData.nameMr.trim(),
      slug: formData.slug.trim() || undefined,
      parentId: formData.parentId || null,
      active: formData.active,
    };

    try {
      setSubmitting(true);
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter out self as potential parent
  const parentOptions = categories.filter((c) => !category || c._id !== category._id);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-[#166534]" />
            <h2 className="text-base font-bold text-slate-900">
              {isEdit ? 'Edit Category' : t('inventory.actions.addCategory')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              English Category Name *
            </label>
            <input
              type="text"
              name="nameEn"
              value={formData.nameEn}
              onChange={handleNameEnChange}
              placeholder="e.g. Chemical Fertilizers"
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#166534] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Marathi Category Name *
            </label>
            <input
              type="text"
              name="nameMr"
              value={formData.nameMr}
              onChange={handleChange}
              placeholder="उदा. रासायनिक खते"
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#166534] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              URL Slug
            </label>
            <input
              type="text"
              name="slug"
              value={formData.slug}
              onChange={handleChange}
              placeholder="e.g. chemical-fertilizers"
              className="w-full px-3 py-2 text-sm lowercase border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#166534] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Parent Category (Optional)
            </label>
            <select
              name="parentId"
              value={formData.parentId}
              onChange={handleChange}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-[#166534] focus:outline-none"
            >
              <option value="">-- No Parent (Top-level Category) --</option>
              {parentOptions.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.nameEn} ({c.nameMr})
                </option>
              ))}
            </select>
          </div>

          {isEdit && (
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 pt-1">
              <input
                type="checkbox"
                name="active"
                checked={formData.active}
                onChange={handleChange}
                className="rounded text-[#166534] focus:ring-[#166534]"
              />
              <span>Category Active</span>
            </label>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              {t('inventory.actions.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon={Save}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : t('inventory.actions.save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
