import mongoose from "mongoose";
import { DEFAULT_USER_GROUP } from "../constants/groups.js";

const SectionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    notes: {
        type: String,
        default: "",
        maxlength: 5000
    }
}, { _id: false });

const DailySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },

    username: {
        type: String,
        required: true
    },

    group: {
        type: String,
        default: DEFAULT_USER_GROUP,
        required: true
    },

    date: {
        type: Date,
        required: true
    },

    sections: {
        type: [SectionSchema],
        default: []
    },

    state: {
        type: Number,
        default: 1
    }

});

const Daily = mongoose.models.Daily || mongoose.model("Daily", DailySchema);
export default Daily;
