import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

/**
 * Shared Pinia factory for job / freelancer / personal profile lists.
 * Mirrors former Vuex module behavior (including PATCH-merge for selected profile).
 */
export function defineProfileCollectionStore(storeId, api, defaultFilters = {}) {
  return defineStore(storeId, () => {
    const profiles = ref([]);
    const selectedProfile = ref(null);
    const loading = ref(false);
    const error = ref(null);
    const filters = ref({
      search: '',
      status: '',
      owner: '',
      ...defaultFilters
    });

    const hasSelectedProfile = computed(
      () => !!selectedProfile.value && Object.keys(selectedProfile.value).length > 0
    );

    function mergeSelectedPatch(patch) {
      if (!selectedProfile.value) {
        selectedProfile.value = { ...patch };
        return;
      }
      selectedProfile.value = {
        ...selectedProfile.value,
        ...patch,
        pictureFileId: patch.pictureFileId ?? selectedProfile.value.pictureFileId,
        attachments: patch.attachments ?? selectedProfile.value.attachments
      };
    }

    function updateProfileInList(updatedProfile) {
      const id = updatedProfile._id || updatedProfile.id;
      const index = profiles.value.findIndex((p) => (p._id || p.id) === id);
      if (index !== -1) {
        profiles.value[index] = { ...profiles.value[index], ...updatedProfile };
      }
    }

    function removeProfileFromList(profileId) {
      profiles.value = profiles.value.filter((p) => (p._id || p.id) !== profileId);
    }

    async function fetchProfiles() {
      loading.value = true;
      error.value = null;
      try {
        const query = { limit: 1000, ...filters.value };
        const response = await api.fetchProfiles(query);
        if (response.ok && response.data) {
          profiles.value = response.data.profiles || [];
          return { ok: true, data: response.data };
        }
        const msg = response.message || 'Failed to load profiles';
        error.value = msg;
        return { ok: false, message: msg };
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to load profiles';
        error.value = msg;
        return { ok: false, message: msg };
      } finally {
        loading.value = false;
      }
    }

    async function fetchProfile(profileId) {
      loading.value = true;
      error.value = null;
      try {
        const response = await api.getProfile(profileId);
        if (response.ok && response.data?.profile) {
          selectedProfile.value = response.data.profile;
          return { ok: true, data: response.data };
        }
        const msg = response.message || 'Failed to load profile';
        error.value = msg;
        return { ok: false, message: msg };
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to load profile';
        error.value = msg;
        return { ok: false, message: msg };
      } finally {
        loading.value = false;
      }
    }

    async function createProfile(profileData) {
      loading.value = true;
      error.value = null;
      try {
        const response = await api.createProfile(profileData);
        if (response.ok && response.data?.profile) {
          await fetchProfiles();
          return { ok: true, data: response.data };
        }
        const msg = response.message || 'Failed to create profile';
        error.value = msg;
        return { ok: false, message: msg };
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to create profile';
        error.value = msg;
        return { ok: false, message: msg };
      } finally {
        loading.value = false;
      }
    }

    async function updateProfile({ profileId, profileData }) {
      loading.value = true;
      error.value = null;
      try {
        const response = await api.updateProfile(profileId, profileData);
        if (response.ok) {
          const updatedProfile = response.data.profile || response.data.data?.profile;
          if (updatedProfile) {
            updateProfileInList(updatedProfile);
          }
          const sel = selectedProfile.value;
          if (sel && (sel._id || sel.id) === profileId) {
            mergeSelectedPatch(updatedProfile || profileData);
          }
          return { ok: true, data: response.data };
        }
        const msg = response.message || 'Failed to update profile';
        error.value = msg;
        return { ok: false, message: msg };
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to update profile';
        error.value = msg;
        return { ok: false, message: msg };
      } finally {
        loading.value = false;
      }
    }

    async function deleteProfile(profileId) {
      loading.value = true;
      error.value = null;
      try {
        const response = await api.deleteProfile(profileId);
        if (response.ok) {
          removeProfileFromList(profileId);
          const sel = selectedProfile.value;
          if (sel && (sel._id || sel.id) === profileId) {
            selectedProfile.value = null;
          }
          return { ok: true };
        }
        const msg = response.message || 'Failed to delete profile';
        error.value = msg;
        return { ok: false, message: msg };
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to delete profile';
        error.value = msg;
        return { ok: false, message: msg };
      } finally {
        loading.value = false;
      }
    }

    async function uploadProfilePicture({ profileId, pictureFile }) {
      loading.value = true;
      error.value = null;
      try {
        const response = await api.uploadProfilePicture(profileId, pictureFile);
        if (response.ok) {
          const updatedProfile = response.data.profile || response.data.data?.profile;
          if (updatedProfile) {
            mergeSelectedPatch(updatedProfile);
            updateProfileInList(updatedProfile);
          }
          return { ok: true, data: response.data };
        }
        const msg = response.message || 'Failed to upload picture';
        error.value = msg;
        return { ok: false, message: msg };
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to upload picture';
        error.value = msg;
        return { ok: false, message: msg };
      } finally {
        loading.value = false;
      }
    }

    async function uploadAttachments({ profileId, files }) {
      loading.value = true;
      error.value = null;
      try {
        const response =
          files.length > 1
            ? await api.uploadAttachments(profileId, files)
            : await api.uploadAttachment(profileId, files[0]);
        if (response.ok) {
          const updatedProfile = response.data.profile || response.data.data?.profile;
          if (updatedProfile) {
            mergeSelectedPatch(updatedProfile);
            updateProfileInList(updatedProfile);
          }
          return { ok: true, data: response.data };
        }
        const msg = response.message || 'Failed to upload attachments';
        error.value = msg;
        return { ok: false, message: msg };
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to upload attachments';
        error.value = msg;
        return { ok: false, message: msg };
      } finally {
        loading.value = false;
      }
    }

    async function deleteAttachment({ profileId, fileId }) {
      loading.value = true;
      error.value = null;
      try {
        const response = await api.deleteAttachment(profileId, fileId);
        if (response.ok) {
          const updatedProfile = response.data.profile || response.data.data?.profile;
          if (updatedProfile) {
            mergeSelectedPatch(updatedProfile);
            updateProfileInList(updatedProfile);
          }
          return { ok: true, data: response.data };
        }
        const msg = response.message || 'Failed to delete attachment';
        error.value = msg;
        return { ok: false, message: msg };
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to delete attachment';
        error.value = msg;
        return { ok: false, message: msg };
      } finally {
        loading.value = false;
      }
    }

    function setFilters(partial) {
      filters.value = { ...filters.value, ...partial };
    }

    function selectProfile(profile) {
      selectedProfile.value = profile;
    }

    function clearSelectedProfile() {
      selectedProfile.value = null;
    }

    return {
      profiles,
      selectedProfile,
      loading,
      error,
      filters,
      hasSelectedProfile,
      fetchProfiles,
      fetchProfile,
      createProfile,
      updateProfile,
      deleteProfile,
      uploadProfilePicture,
      uploadAttachments,
      deleteAttachment,
      setFilters,
      selectProfile,
      clearSelectedProfile
    };
  });
}
