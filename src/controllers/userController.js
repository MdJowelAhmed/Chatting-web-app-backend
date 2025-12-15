import User from '../models/User.js';
import fs from 'fs';
import path from 'path';

// @desc    Get all users (for search/contacts)
// @route   GET /api/users
// @access  Private
export const getUsers = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    let query = { _id: { $ne: req.user._id } };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('name email phone avatar isOnline lastSeen about')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ name: 1 });

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select(
      'name email phone avatar isOnline lastSeen about createdAt'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
  try {
    const { name, about, phone } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (about !== undefined) updateData.about = about;
    if (phone) updateData.phone = phone;

    const user = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user avatar
// @route   PUT /api/users/avatar
// @access  Private
export const updateAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image',
      });
    }

    // Get old avatar to delete
    const oldUser = await User.findById(req.user._id);
    
    // Delete old avatar if exists
    if (oldUser.avatar) {
      const oldPath = path.join('./uploads', oldUser.avatar);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Update with new avatar
    const avatarPath = `avatars/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: avatarPath },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Avatar updated successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add user to contacts
// @route   POST /api/users/contacts/:userId
// @access  Private
export const addContact = async (req, res, next) => {
  try {
    const contactId = req.params.userId;

    // Check if contact exists
    const contact = await User.findById(contactId);
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if already in contacts
    const user = await User.findById(req.user._id);
    if (user.contacts.includes(contactId)) {
      return res.status(400).json({
        success: false,
        message: 'User already in contacts',
      });
    }

    // Add to contacts
    user.contacts.push(contactId);
    await user.save();

    const updatedUser = await User.findById(req.user._id).populate(
      'contacts',
      'name avatar isOnline lastSeen about'
    );

    res.status(200).json({
      success: true,
      message: 'Contact added successfully',
      data: updatedUser.contacts,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove user from contacts
// @route   DELETE /api/users/contacts/:userId
// @access  Private
export const removeContact = async (req, res, next) => {
  try {
    const contactId = req.params.userId;

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { contacts: contactId },
    });

    res.status(200).json({
      success: true,
      message: 'Contact removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Block a user
// @route   POST /api/users/block/:userId
// @access  Private
export const blockUser = async (req, res, next) => {
  try {
    const userToBlock = req.params.userId;

    const user = await User.findById(req.user._id);
    
    if (user.blockedUsers.includes(userToBlock)) {
      return res.status(400).json({
        success: false,
        message: 'User already blocked',
      });
    }

    user.blockedUsers.push(userToBlock);
    await user.save();

    res.status(200).json({
      success: true,
      message: 'User blocked successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unblock a user
// @route   DELETE /api/users/block/:userId
// @access  Private
export const unblockUser = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { blockedUsers: req.params.userId },
    });

    res.status(200).json({
      success: true,
      message: 'User unblocked successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get blocked users
// @route   GET /api/users/blocked
// @access  Private
export const getBlockedUsers = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate(
      'blockedUsers',
      'name avatar'
    );

    res.status(200).json({
      success: true,
      data: user.blockedUsers,
    });
  } catch (error) {
    next(error);
  }
};

