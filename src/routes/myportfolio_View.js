
const router = require("express").Router();
const {
  Intro,
  Project,
  Education,
  Expereince,
  Skill,
} = require("../models/portFolio");
const User = require("../models/registers");
const upload = require("../utils/multer");
const cloudinary = require("../utils/cloudinary");
const streamifier = require("streamifier");
const mongoose = require("mongoose");
const { getOrSetCache, invalidateCache } = require("../utils/cacheHelper");

// ─── Cache key constants ────────────────────────────────────────────────────
// Centralising keys avoids typos in invalidation calls.
const CACHE_KEYS = {
  ALL_PORTFOLIO: "portfolio:all",           // GET /get-portfolio
  USER_PORTFOLIO: (name) => `portfolio:user:${name.toLowerCase()}`, // GET /get-portfolio/:name
};

// Default TTL in seconds (5 minutes). Adjust as needed.
const CACHE_TTL = 5000;

// ─── GET all portfolio data ─────────────────────────────────────────────────
router.get("/get-portfolio", async (req, res) => {
  try {
    // getOrSetCache: returns from Redis if warm, fetches from MongoDB if cold
    const userProfile = await getOrSetCache(
      CACHE_KEYS.ALL_PORTFOLIO,
      CACHE_TTL,
      async () => {
        // This function only runs on a cache MISS
        const [Intros, Projects, Educations, Experiences, Skills] =
          await Promise.all([
            Intro.find(),
            Project.find(),
            Education.find(),
            Expereince.find(),
            Skill.find(),
          ]);

        return {
          intro: Intros[0],
          projects: Projects,
          education: Educations,
          experience: Experiences,
          skills: Skills,
        };
      }
    );

    // console.log("userprofile cache",userProfile)

    res.status(200).send({
      data: userProfile,
      success: true,
      message: "All Portfolio get Data Successfully",
    });
  } catch (error) {
    res.status(500).send({
      error: "Internal Server Error",
      message: error.message,
      stack: error.stack,
    });
  }
});

// ─── GET portfolio by user name ─────────────────────────────────────────────
router.get("/get-portfolio/:name", async (req, res) => {
  try {
    const { name } = req.params;

    const userProfile = await getOrSetCache(
      CACHE_KEYS.USER_PORTFOLIO(name),
      CACHE_TTL,
      async () => {
        // Find user by first name (case-insensitive)
        const user = await User.findOne({
          firstName: { $regex: new RegExp(name, "i") },
        });

        if (!user) return null; // Signal not found

        const userId = new mongoose.Types.ObjectId(user._id);

        const [Intros, Projects, Educations, Experiences, Skills] =
          await Promise.all([
            Intro.find({ userId }),
            Project.find({ userId }),
            Education.find({ userId }),
            Expereince.find({ userId }),
            Skill.find({ userId }),
          ]);

        return {
          intro: Intros[0] || null,
          projects: Projects,
          education: Educations,
          experience: Experiences,
          skills: Skills,
        };
      }
    );

    if (!userProfile) {
      return res.status(404).json({
        success: false,
        message: `No user found with name: ${name}`,
      });
    }

    res.status(200).json({
      success: true,
      message: `Portfolio data fetched successfully for: ${name}`,
      data: userProfile,
    });
  } catch (error) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
      stack: error.stack,
    });
  }
});

// ─── ADD INTRO ──────────────────────────────────────────────────────────────
// Bug fix: was using `Intros` (undefined) — changed to `intros`
router.post("/add-intro", async (req, res) => {
  try {
    const intros = new Intro({
      ...req.body,
      userId: req.body.userId,
    });
    await intros.save();

    // Invalidate portfolio cache so next GET fetches fresh data
    await invalidateCache(CACHE_KEYS.ALL_PORTFOLIO);

    res.status(200).send({
      data: intros,
      success: true,
      message: "Intro added Successfully",
    });
  } catch (error) {
    res.status(500).send(error);
  }
});

// ─── UPDATE INTRO ───────────────────────────────────────────────────────────
router.post("/update-intro", upload.single("profile_url"), async (req, res) => {
  try {
    const { _id, ...updateData } = req.body;

    if (!_id) {
      return res.status(400).json({
        success: false,
        message: "Intro ID is required",
      });
    }

    if (req.file) {
      const streamUpload = () =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "portfolio_profile" },
            (error, result) => {
              if (result) resolve(result);
              else reject(error);
            }
          );
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });

      const result = await streamUpload();
      updateData.profile_url = result.secure_url;
    }

    const intro = await Intro.findByIdAndUpdate(_id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!intro) {
      return res.status(404).json({
        success: false,
        message: "Intro not found",
      });
    }

    // Invalidate both caches after update
    await invalidateCache(CACHE_KEYS.ALL_PORTFOLIO);

    res.status(200).json({
      success: true,
      message: "Intro Updated Successfully",
      data: intro,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── DELETE INTRO ───────────────────────────────────────────────────────────
router.post("/delete-intro", async (req, res) => {
  try {
    const bio = await Intro.findOneAndDelete({ _id: req.body._id });
    await invalidateCache(CACHE_KEYS.ALL_PORTFOLIO);

    res.status(200).send({
      data: bio,
      success: true,
      message: "Intro deleted Successfully",
    });
  } catch (error) {
    res.status(500).send(error);
  }
});

// ─── ADD EXPERIENCE ─────────────────────────────────────────────────────────
router.post("/add-experience", async (req, res) => {
  try {
    const experience = new Expereince({
      ...req.body,
      userId: req.body.userId,
    });
    await experience.save();
    await invalidateCache(CACHE_KEYS.ALL_PORTFOLIO);

    res.status(200).send({
      data: experience,
      success: true,
      message: "Experience added Successfully",
    });
  } catch (error) {
    res.status(500).send(error);
  }
});

// ─── UPDATE EXPERIENCE ──────────────────────────────────────────────────────
router.post("/update-experience", async (req, res) => {
  try {
    const experience = await Expereince.findOneAndUpdate(
      { _id: req.body._id },
      req.body,
      { new: true }
    );
    await invalidateCache(CACHE_KEYS.ALL_PORTFOLIO);

    res.status(200).send({
      data: experience,
      success: true,
      message: "Experience updated Successfully",
    });
  } catch (error) {
    res.status(500).send(error);
  }
});

// ─── DELETE EXPERIENCE ──────────────────────────────────────────────────────
router.post("/delete-experience", async (req, res) => {
  try {
    const experience = await Expereince.findOneAndDelete({ _id: req.body._id });
    await invalidateCache(CACHE_KEYS.ALL_PORTFOLIO);

    res.status(200).send({
      data: experience,
      success: true,
      message: "Experience deleted Successfully",
    });
  } catch (error) {
    res.status(500).send(error);
  }
});

// ─── ADD PROJECT ─────────────────────────────────────────────────────────────
router.post("/add-project", async (req, res) => {
  try {
    const project = new Project({
      ...req.body,
      userId: req.body.userId,
    });
    await project.save();
    await invalidateCache(CACHE_KEYS.ALL_PORTFOLIO);

    res.status(200).send({
      data: project,
      success: true,
      message: "Project added Successfully",
    });
  } catch (error) {
    res.status(500).send(error);
  }
});

// ─── UPDATE PROJECT ──────────────────────────────────────────────────────────
router.post("/update-project", async (req, res) => {
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.body._id },
      req.body,
      { new: true }
    );
    await invalidateCache(CACHE_KEYS.ALL_PORTFOLIO);

    res.status(200).send({
      data: project,
      success: true,
      message: "Project updated Successfully",
    });
  } catch (error) {
    res.status(500).send(error);
  }
});

// ─── DELETE PROJECT ──────────────────────────────────────────────────────────
router.post("/delete-project", async (req, res) => {
  try {
    const project = await Project.findOneAndDelete({ _id: req.body._id });
    await invalidateCache(CACHE_KEYS.ALL_PORTFOLIO);

    res.status(200).send({
      data: project,
      success: true,
      message: "Project deleted Successfully",
    });
  } catch (error) {
    res.status(500).send(error);
  }
});

// ─── ADD SKILLS ──────────────────────────────────────────────────────────────
router.post("/add-skills", async (req, res) => {
  try {
    if (!req.body.userId) {
      return res.status(400).send({
        data: null,
        success: false,
        message: "userId is required",
      });
    }

    const skill = new Skill({
      title: req.body.title,
      skills: req.body.skills,
      userId: req.body.userId,
    });
    const newSkill = await skill.save();
    await invalidateCache(CACHE_KEYS.ALL_PORTFOLIO);

    res.status(200).send({
      data: newSkill,
      success: true,
      message: "Skills added Successfully",
    });
  } catch (error) {
    res.status(500).send(error);
  }
});

// ─── UPDATE SKILLS ───────────────────────────────────────────────────────────
router.post("/update-skills", async (req, res) => {
  try {
    const updatedSkill = await Skill.findOneAndUpdate(
      { _id: req.body._id },
      req.body,
      { new: true }
    );
    await invalidateCache(CACHE_KEYS.ALL_PORTFOLIO);

    res.status(200).send({
      data: updatedSkill,
      success: true,
      message: "Skills updated successfully.",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "An error occurred while updating skills.",
      error: error.message,
    });
  }
});

// ─── DELETE SKILLS ───────────────────────────────────────────────────────────
router.post("/delete-skills", async (req, res) => {
  try {
    const deletedSkill = await Skill.findOneAndDelete({ _id: req.body._id });
    await invalidateCache(CACHE_KEYS.ALL_PORTFOLIO);

    res.status(200).send({
      data: deletedSkill,
      success: true,
      message: "Skills deleted successfully.",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "An error occurred while deleting skills.",
      error: error.message,
    });
  }
});

// ─── ADD EDUCATION ───────────────────────────────────────────────────────────
router.post("/add-education", async (req, res) => {
  try {
    const eduCation = new Education({
      ...req.body,
      userId: req.body.userId,
    });
    await eduCation.save();
    await invalidateCache(CACHE_KEYS.ALL_PORTFOLIO);

    res.status(200).send({
      data: eduCation,
      success: true,
      message: "Education added Successfully",
    });
  } catch (error) {
    res.status(500).send(error);
  }
});

// ─── UPDATE EDUCATION ────────────────────────────────────────────────────────
router.post("/update-education", async (req, res) => {
  try {
    const eduCation = await Education.findOneAndUpdate(
      { _id: req.body._id },
      req.body,
      { new: true }
    );
    await invalidateCache(CACHE_KEYS.ALL_PORTFOLIO);

    res.status(200).send({
      data: eduCation,
      success: true,
      message: "Education updated Successfully",
    });
  } catch (error) {
    res.status(500).send(error);
  }
});

// ─── DELETE EDUCATION ────────────────────────────────────────────────────────
router.post("/delete-education", async (req, res) => {
  try {
    const eduCation = await Education.findOneAndDelete({ _id: req.body._id });
    await invalidateCache(CACHE_KEYS.ALL_PORTFOLIO);

    res.status(200).send({
      data: eduCation,
      success: true,
      message: "Education deleted Successfully",
    });
  } catch (error) {
    res.status(500).send(error);
  }
});

module.exports = router;