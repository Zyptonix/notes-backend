// ==============================================================================
// File: backend/controllers/noteController.js
// Purpose: Note CRUD controller with RBAC, Pagination, and Index Utilization
// ==============================================================================

const Note = require('../models/Note');

/**
 * @desc    Create a new note
 * @route   POST /api/notes
 * @access  Private (User or Admin)
 */
exports.createNote = async (req, res, next) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both a title and content for the note.',
      });
    }

    // Assign owner to current logged-in user
    const note = await Note.create({
      title,
      content,
      owner: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: 'Note created successfully',
      data: note,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get paginated list of notes
 *          - Regular user: Can only see their OWN notes (filtered by owner: req.user._id)
 *          - Admin: Can see notes from EVERYONE
 * @route   GET /api/notes
 * @access  Private
 */
exports.getNotes = async (req, res, next) => {
  try {
    // 1. Pagination Parameters
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // 2. Build Query based on Role-Based Access Control (RBAC)
    let query = {};

    if (req.user.role === 'admin') {
      // Admin: Can view everyone's notes.
      // If admin wants to filter by a specific owner via query param (?owner=...):
      if (req.query.owner) {
        query.owner = req.query.owner;
      }
      // Index used: { createdAt: -1 } (or { owner: 1, createdAt: -1 } if filtering by owner)
    } else {
      // Regular User: Strictly restricted to their OWN notes
      query.owner = req.user._id;
      // Index used: { owner: 1, createdAt: -1 } (Compound Index)
    }

    // 3. Count total documents matching query
    const total = await Note.countDocuments(query);

    // 4. Execute query with Sort & Pagination
    // Sorts newest first (-1)
    const notes = await Note.find(query)
      .populate('owner', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // 5. Return paginated response
    res.status(200).json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
      count: notes.length,
      data: notes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a single note by ID
 *          - Regular user: Can only view if they own it
 *          - Admin: Can view any note
 * @route   GET /api/notes/:id
 * @access  Private
 */
exports.getNoteById = async (req, res, next) => {
  try {
    // Primary index {_id: 1} is automatically used here
    const note = await Note.findById(req.params.id).populate('owner', 'name email role');

    if (!note) {
      return res.status(404).json({
        success: false,
        message: `Note not found with id: ${req.params.id}`,
      });
    }

    // RBAC: Verify ownership if not admin
    if (req.user.role !== 'admin' && note.owner._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to view this note.',
      });
    }

    res.status(200).json({
      success: true,
      data: note,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a note by ID
 *          - Regular user: Can only update their own note
 *          - Admin: Can update any note
 * @route   PUT /api/notes/:id
 * @access  Private
 */
exports.updateNote = async (req, res, next) => {
  try {
    let note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: `Note not found with id: ${req.params.id}`,
      });
    }

    // RBAC check
    if (req.user.role !== 'admin' && note.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to edit this note.',
      });
    }

    const { title, content } = req.body;
    if (title !== undefined) note.title = title;
    if (content !== undefined) note.content = content;

    await note.save();

    res.status(200).json({
      success: true,
      message: 'Note updated successfully',
      data: note,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a note by ID
 *          - Regular user: Can only delete their own note
 *          - Admin: Can delete any note
 * @route   DELETE /api/notes/:id
 * @access  Private
 */
exports.deleteNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: `Note not found with id: ${req.params.id}`,
      });
    }

    // RBAC check
    if (req.user.role !== 'admin' && note.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to delete this note.',
      });
    }

    await note.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Note deleted successfully',
      data: {},
    });
  } catch (error) {
    next(error);
  }
};
