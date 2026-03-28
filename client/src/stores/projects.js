import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import * as projectService from '../services/projects';

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref([]);
  const currentProject = ref(null);
  const loading = ref(false);
  const error = ref(null);
  const pagination = ref({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });

  // Getters
  const projectsByStatus = computed(() => {
    const grouped = {
      active: [],
      paused: [],
      done: []
    };
    projects.value.forEach(project => {
      if (grouped[project.status]) {
        grouped[project.status].push(project);
      }
    });
    return grouped;
  });

  const activeProjects = computed(() => projectsByStatus.value.active);
  const pausedProjects = computed(() => projectsByStatus.value.paused);
  const completedProjects = computed(() => projectsByStatus.value.done);

  const projectById = computed(() => {
    return (id) => projects.value.find(p => p._id === id);
  });

  const projectsByOwner = computed(() => {
    return (userId) => projects.value.filter(p => p.ownerUserId === userId);
  });

  const projectsByCollaborator = computed(() => {
    return (userId) => projects.value.filter(p => 
      p.collaboratorUserIds && p.collaboratorUserIds.includes(userId)
    );
  });

  // Actions
  const fetchProjects = async (filters = {}) => {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await projectService.fetchProjects(filters);
      if (response.ok && response.data) {
        projects.value = response.data.projects || [];
        if (response.data.pagination) {
          pagination.value = response.data.pagination;
        }
      } else {
        throw new Error(response.message || 'Failed to fetch projects');
      }
    } catch (err) {
      error.value = err.response?.data?.message || err.message || 'Failed to fetch projects';
      projects.value = [];
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const fetchProject = async (id) => {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await projectService.getProject(id);
      if (response.ok && response.data) {
        currentProject.value = response.data.project;
        
        // Update in projects array if exists
        const index = projects.value.findIndex(p => p._id === id);
        if (index !== -1) {
          projects.value[index] = response.data.project;
        } else {
          projects.value.push(response.data.project);
        }
        
        return response.data.project;
      } else {
        throw new Error(response.message || 'Failed to fetch project');
      }
    } catch (err) {
      error.value = err.response?.data?.message || err.message || 'Failed to fetch project';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const createProject = async (projectData) => {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await projectService.createProject(projectData);
      if (response.ok && response.data) {
        projects.value.push(response.data.project);
        currentProject.value = response.data.project;
        return response.data.project;
      } else {
        throw new Error(response.message || 'Failed to create project');
      }
    } catch (err) {
      error.value = err.response?.data?.message || err.message || 'Failed to create project';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateProject = async (id, projectData) => {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await projectService.updateProject(id, projectData);
      if (response.ok && response.data) {
        const index = projects.value.findIndex(p => p._id === id);
        if (index !== -1) {
          projects.value[index] = response.data.project;
        }
        if (currentProject.value && currentProject.value._id === id) {
          currentProject.value = response.data.project;
        }
        return response.data.project;
      } else {
        throw new Error(response.message || 'Failed to update project');
      }
    } catch (err) {
      error.value = err.response?.data?.message || err.message || 'Failed to update project';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteProject = async (id) => {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await projectService.deleteProject(id);
      if (response.ok) {
        projects.value = projects.value.filter(p => p._id !== id);
        if (currentProject.value && currentProject.value._id === id) {
          currentProject.value = null;
        }
        return true;
      } else {
        throw new Error(response.message || 'Failed to delete project');
      }
    } catch (err) {
      error.value = err.response?.data?.message || err.message || 'Failed to delete project';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const setCurrentProject = (project) => {
    currentProject.value = project;
  };

  const clearCurrentProject = () => {
    currentProject.value = null;
  };

  const clearError = () => {
    error.value = null;
  };

  return {
    // State
    projects,
    currentProject,
    loading,
    error,
    pagination,
    
    // Getters
    projectsByStatus,
    activeProjects,
    pausedProjects,
    completedProjects,
    projectById,
    projectsByOwner,
    projectsByCollaborator,
    
    // Actions
    fetchProjects,
    fetchProject,
    createProject,
    updateProject,
    deleteProject,
    setCurrentProject,
    clearCurrentProject,
    clearError
  };
});
