import * as profileService from '../services/jobProfiles';
import { defineProfileCollectionStore } from './profileCollectionStore';

export const useJobProfilesStore = defineProfileCollectionStore(
  'jobProfiles',
  {
    fetchProfiles: profileService.fetchJobProfiles,
    getProfile: profileService.getJobProfile,
    createProfile: profileService.createJobProfile,
    updateProfile: profileService.updateJobProfile,
    deleteProfile: profileService.deleteJobProfile,
    uploadProfilePicture: profileService.uploadProfilePicture,
    uploadAttachments: profileService.uploadAttachments,
    uploadAttachment: profileService.uploadAttachment,
    deleteAttachment: profileService.deleteAttachment
  },
  { group: '' }
);
