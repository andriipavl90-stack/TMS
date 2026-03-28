import * as profileService from '../services/freelancerProfiles';
import { defineProfileCollectionStore } from './profileCollectionStore';

export const useFreelancerProfilesStore = defineProfileCollectionStore(
  'freelancerProfiles',
  {
    fetchProfiles: profileService.fetchFreelancerProfiles,
    getProfile: profileService.getFreelancerProfile,
    createProfile: profileService.createFreelancerProfile,
    updateProfile: profileService.updateFreelancerProfile,
    deleteProfile: profileService.deleteFreelancerProfile,
    uploadProfilePicture: profileService.uploadProfilePicture,
    uploadAttachments: profileService.uploadAttachments,
    uploadAttachment: profileService.uploadAttachment,
    deleteAttachment: profileService.deleteAttachment
  }
);
