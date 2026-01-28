'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, ArrowLeft, Folder, Calendar, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface Project {
  id: string;
  name: string;
  type: string;
  status: string;
  created_at: string;
}

export default function HistorialPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', 'static_ads'],
    queryFn: async () => {
      const response = await fetch('/api/projects?type=static_ads');
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json() as Promise<Project[]>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete project');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Proyecto eliminado');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setDeleteConfirm(null);
    },
    onError: () => {
      toast.error('Error al eliminar el proyecto');
    },
  });

  const handleDelete = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setDeleteConfirm(projectId);
  };

  const confirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm);
    }
  };

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-8 flex items-center gap-4">
        <button
          onClick={() => router.push('/crear/static-ads')}
          className="flex items-center gap-2 text-gray-400 transition hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm">Volver</span>
        </button>
        <h1 className="text-2xl font-bold text-white">Historial de Proyectos</h1>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#07A498]" />
        </div>
      ) : projects?.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-800 bg-[#141414] py-20 text-center">
          <Folder className="mb-4 h-16 w-16 text-gray-700" />
          <h3 className="text-lg font-medium text-white">No hay proyectos</h3>
          <p className="mt-2 text-gray-400">
            Crea tu primer proyecto de Static Ads para verlo aquí.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects?.map((project) => (
            <div
              key={project.id}
              onClick={() => router.push(`/crear/static-ads/historial/${project.id}`)}
              className="group relative cursor-pointer overflow-hidden rounded-xl border border-gray-800 bg-[#1a2332] transition hover:border-[#07A498] hover:shadow-lg hover:shadow-[#07A498]/10"
            >
              {/* Delete button */}
              <button
                onClick={(e) => handleDelete(e, project.id)}
                className="absolute top-2 right-2 z-10 p-2 rounded-lg bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 transition hover:bg-red-500/20"
              >
                <Trash2 className="h-4 w-4" />
              </button>

              {/* Delete confirmation */}
              {deleteConfirm === project.id && (
                <div 
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 p-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-sm text-white text-center mb-4">¿Eliminar este proyecto?</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                      className="border-gray-600"
                    >
                      <X className="h-4 w-4 mr-1" />
                      No
                    </Button>
                    <Button
                      size="sm"
                      onClick={confirmDelete}
                      disabled={deleteMutation.isPending}
                      className="bg-red-500 hover:bg-red-600 text-white"
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-1" />
                          Sí, eliminar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex h-32 items-center justify-center bg-[#0a0a0a] transition group-hover:bg-[#0f141c]">
                <Folder className="h-12 w-12 text-[#07A498]/50 group-hover:text-[#07A498]" />
              </div>
              <div className="p-4">
                <h3 className="mb-1 truncate text-lg font-semibold text-white group-hover:text-[#07A498]">
                  {project.name}
                </h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {format(new Date(project.created_at), "d 'de' MMMM, yyyy", {
                        locale: es,
                      })}
                    </span>
                  </div>
                  {project.status === 'processing' && (
                    <span className="text-xs text-yellow-400 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      En proceso
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
