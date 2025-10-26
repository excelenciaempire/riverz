'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
import { Modal } from '@/components/admin/ui/modal';
import { Loading } from '@/components/admin/ui/loading';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react';

interface Avatar {
  id: string;
  name: string;
  image_url: string;
  is_active: boolean;
  created_at: string;
}

export function AvatarsManager() {
  const [showModal, setShowModal] = useState(false);
  const [editingAvatar, setEditingAvatar] = useState<Avatar | null>(null);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const supabase = createClient();
  const queryClient = useQueryClient();

  // Fetch avatars
  const { data: avatars, isLoading } = useQuery({
    queryKey: ['admin-avatars'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avatars')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Avatar[];
    },
  });

  // Create/Update avatar
  const saveMutation = useMutation({
    mutationFn: async () => {
      let finalImageUrl = imageUrl;

      // Upload file if present
      if (uploadedFile) {
        finalImageUrl = await uploadToSupabase(uploadedFile);
      }

      if (!finalImageUrl) {
        throw new Error('Se requiere una imagen');
      }

      if (editingAvatar) {
        // Update
        const { error } = await supabase
          .from('avatars')
          .update({ name, image_url: finalImageUrl, is_active: isActive })
          .eq('id', editingAvatar.id);

        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase
          .from('avatars')
          .insert([{ name, image_url: finalImageUrl, is_active: isActive }]);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-avatars'] });
      queryClient.invalidateQueries({ queryKey: ['avatars'] });
      toast.success(editingAvatar ? 'Avatar actualizado' : 'Avatar creado');
      resetForm();
    },
    onError: (error) => {
      toast.error('Error al guardar avatar');
      console.error(error);
    },
  });

  // Delete avatar
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('avatars').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-avatars'] });
      queryClient.invalidateQueries({ queryKey: ['avatars'] });
      toast.success('Avatar eliminado');
    },
    onError: (error) => {
      toast.error('Error al eliminar avatar');
      console.error(error);
    },
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('avatars')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-avatars'] });
      queryClient.invalidateQueries({ queryKey: ['avatars'] });
      toast.success('Estado actualizado');
    },
    onError: (error) => {
      toast.error('Error al actualizar estado');
      console.error(error);
    },
  });

  const uploadToSupabase = async (file: File): Promise<string> => {
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setShowModal(false);
    setEditingAvatar(null);
    setName('');
    setImageUrl('');
    setIsActive(true);
    setUploadedFile(null);
  };

  const handleEdit = (avatar: Avatar) => {
    setEditingAvatar(avatar);
    setName(avatar.name);
    setImageUrl(avatar.image_url);
    setIsActive(avatar.is_active);
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Estás seguro de eliminar este avatar?')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return <Loading text="Cargando avatares..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Gestionar Avatares</h2>
          <p className="mt-2 text-gray-400">
            Administra la biblioteca de avatares disponibles para UGC
          </p>
        </div>
        <Button
          onClick={() => setShowModal(true)}
          className="bg-brand-accent hover:bg-brand-accent/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Agregar Avatar
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {avatars?.map((avatar) => (
          <div
            key={avatar.id}
            className="overflow-hidden rounded-xl border border-gray-800 bg-[#141414] transition hover:border-gray-700"
          >
            <div className="aspect-square overflow-hidden">
              <img
                src={avatar.image_url}
                alt={avatar.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium text-white">{avatar.name}</h3>
                <button
                  onClick={() => toggleActiveMutation.mutate({ id: avatar.id, isActive: avatar.is_active })}
                  className={`rounded-full p-1.5 transition ${
                    avatar.is_active
                      ? 'bg-green-500/20 text-green-500'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {avatar.is_active ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(avatar)}
                  className="flex-1"
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(avatar.id)}
                  className="flex-1 text-red-500 hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={resetForm}
        title={editingAvatar ? 'Editar Avatar' : 'Agregar Avatar'}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-white">
              Nombre
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Daniel"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white">
              Imagen
            </label>
            <div className="space-y-3">
              {/* File Upload */}
              <div>
                <label className="mb-1.5 block text-xs text-gray-400">
                  Subir desde PC
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setUploadedFile(file);
                      setImageUrl(''); // Clear URL if file is selected
                    }
                  }}
                  className="w-full rounded-lg border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm text-white file:mr-4 file:rounded file:border-0 file:bg-brand-accent file:px-4 file:py-1.5 file:text-sm file:text-white hover:file:bg-brand-accent/90"
                />
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-800"></div>
                <span className="text-xs text-gray-500">o</span>
                <div className="h-px flex-1 bg-gray-800"></div>
              </div>

              {/* URL Input */}
              <div>
                <label className="mb-1.5 block text-xs text-gray-400">
                  URL externa
                </label>
                <Input
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setUploadedFile(null); // Clear file if URL is entered
                  }}
                  placeholder="https://..."
                  disabled={!!uploadedFile}
                />
              </div>

              {/* Preview */}
              {(uploadedFile || imageUrl) && (
                <div className="mt-3">
                  <img
                    src={uploadedFile ? URL.createObjectURL(uploadedFile) : imageUrl}
                    alt="Preview"
                    className="h-32 w-32 rounded-lg object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '';
                      if (!uploadedFile) toast.error('URL de imagen inválida');
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-700 bg-[#1a1a1a] text-brand-accent focus:ring-brand-accent"
            />
            <label htmlFor="is_active" className="text-sm text-gray-400">
              Avatar activo (visible para usuarios)
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={resetForm} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!name || (!imageUrl && !uploadedFile) || saveMutation.isPending || uploading}
              className="flex-1 bg-brand-accent hover:bg-brand-accent/90"
            >
              {uploading ? 'Subiendo...' : saveMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

