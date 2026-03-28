import { createStore } from 'vuex';
import auth from './modules/auth';
import jobProfiles from './modules/jobProfiles';
import freelancerProfiles from './modules/freelancerProfiles';
import personalProfiles from './modules/personalProfiles';
import projects from './modules/projects';
import jobTickets from './modules/jobTickets';

export default createStore({
  modules: {
    auth,
    jobProfiles,
    freelancerProfiles,
    personalProfiles,
    projects,
    jobTickets
  }
});
