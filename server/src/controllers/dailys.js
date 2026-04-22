import express from 'express';
import mongoose from 'mongoose';

import Daily from "../models/Daily.js";
import { DEFAULT_SECTIONS } from "../constants/defaultsection.js";

const router = express.Router();
//c
export const getDailys = async (req, res) => {
    const { userId } = req.params;

    try {
        const dailys = await Daily
            .find({ userId })
            .sort({ date: -1 });

        res.status(200).json(dailys);

    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};

export const getAll = async (req, res) => {
    const role = req.user?.role;
    const group = req.user?.group;

    try {
        // SUPER_ADMIN sees everything; ADMIN sees all groups (cross-group management)
        const query = role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'BOSS'
            ? {}
            : { group };

        const dailys = await Daily.find(query).sort({ date: -1 });
        res.status(200).json(dailys);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
}

//c
export const getTeam = async (req, res) => {
    const { groupID } = req.params;

    try {
        const dailys = await Daily.find({ group: groupID });
        res.status(200).json(dailys);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
}

import User from '../models/User.js';

// Edit restricted to own group only
export const updateDaily = async (req, res) => {
    const { userId, username, group, date } = req.params;
    let { sections, state } = req.body;
    const user = req.user;

    try {
        const normalizedDate = new Date(date);
        normalizedDate.setUTCHours(0, 0, 0, 0);

        // SUPER_ADMIN and ADMIN can manage any group; MEMBER can only edit own group
        const userRole = user?.role;
        if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN' && userRole !== 'BOSS') {
            if (group !== user?.group) {
                return res.status(403).json({ message: 'You can only edit your own group\'s reports' });
            }
        }

        const updatedDaily = await Daily.findOneAndUpdate(
            { userId, date: normalizedDate },
            {
                $set: {
                    userId,
                    username,
                    group,
                    date: normalizedDate,
                    sections,
                    state
                }
            },
            {
                new: true,
                upsert: true
            }
        );

        res.status(200).json(updatedDaily);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
export const deleteDaily = async (req, res) => {
    const { id } = req.params;
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).send(`No post with id: ${id}`);

    const daily = await Daily.findById(id);
    if (!daily) return res.status(404).json({ message: 'Report not found' });

    // SUPER_ADMIN and ADMIN can delete any group; MEMBER can only delete own group
    const userRole = user?.role;
    if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN' && userRole !== 'BOSS') {
        if (daily.group !== user?.group) {
            return res.status(403).json({ message: 'You can only delete your own group\'s reports' });
        }
    }

    await Daily.findByIdAndRemove(id);
    res.json({ message: "DailyReport deleted successfully." });
}

export default router;