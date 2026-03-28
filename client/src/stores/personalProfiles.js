import * as profileService from '../services/personalProfiles';
import { defineProfileCollectionStore } from './profileCollectionStore';

export const usePersonalProfilesStore = defineProfileCollectionStore(
  'personalProfiles',
  {
    fetchProfiles: profileService.fetchPersonalProfiles,
    getProfile: profileService.getPersonalProfile,
    createProfile: profileService.createPersonalProfile,
    updateProfile: profileService.updatePersonalProfile,
    deleteProfile: profileService.deletePersonalProfile,
    uploadProfilePicture: profileService.uploadProfilePicture,
    uploadAttachments: profileService.uploadAttachments,
    uploadAttachment: profileService.uploadAttachment,
    deleteAttachment: profileService.deleteAttachment
  }
);
