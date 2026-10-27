'use client';

import { useState, useEffect } from 'react';
import { getAllAdminProducts, createProduct, updateProduct, deleteProduct } from '@/actions/product.actions';
import type { IProduct } from '@/types';
import { CreateProductModal } from '@/components/admin/CreateProductModal';
import { EditProductModal } from '@/components/admin/EditProductModal';
import { Plus, ShoppingBag, Trash2, Edit2, Loader2 } from 'lucide-react';

export default function OxShoesAdminPage() {
  const [products, setProducts] = useState<IProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<IProduct | null>(null);

  const loadProducts = async () => {
    setLoading(true);
    const res = await getAllAdminProducts();
    if (res.success) {
      setProducts(res.data.filter(p => 
        p.name.toLowerCase().includes('ox') || 
        p.subCategory.toLowerCase().includes('ox') ||
        p.tags.some(tag => tag.toLowerCase().includes('ox'))
      ));
    }
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await getAllAdminProducts();
      if (!active) return;
      if (res.success && res.data) {
        setProducts(res.data.filter(p => 
          p.name.toLowerCase().includes('ox') || 
          p.subCategory.toLowerCase().includes('ox') ||
          p.tags.some(tag => tag.toLowerCase().includes('ox'))
        ));
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleCreate = async (payload: any) => {
    const res = await createProduct(payload);
    if (res.success) {
      await loadProducts();
      return true;
    }
    return false;
  };

  const handleUpdate = async (id: string, updates: Partial<IProduct>) => {
    const res = await updateProduct(id, updates);
    if (res.success) {
      await loadProducts();
      setEditingProduct(null);
      return true;
    }
    return false;
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure?')) {
      await deleteProduct(id);
      await loadProducts();
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-black uppercase text-white flex items-center gap-2">
          <ShoppingBag className="text-amber-500" /> Ox Shoes Management
        </h1>
        <button 
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-amber-500 rounded-xl font-bold text-black flex items-center gap-2"
        >
          <Plus size={16} /> Add Ox Shoe
        </button>
      </div>

      {loading ? (
        <div className="text-white flex justify-center py-10"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden">
          <table className="w-full text-white text-xs">
            <thead className="bg-neutral-950 text-neutral-400">
              <tr>
                <th className="p-3 text-left">Name</th>
                <th className="p-3">Price</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {products.map(p => (
                <tr key={p._id.toString()}>
                  <td className="p-3">{p.name}</td>
                  <td className="p-3 text-center">PKR {p.price}</td>
                  <td className="p-3 flex justify-center gap-2">
                    <button onClick={() => setEditingProduct(p)}><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(p._id.toString())}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateProductModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSubmit={handleCreate} />
      {editingProduct && <EditProductModal product={editingProduct} onClose={() => setEditingProduct(null)} onSubmit={handleUpdate} />}
    </div>
  );
}
