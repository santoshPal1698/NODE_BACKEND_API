const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// ✅ Reusable userId field
const userIdField = {
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: false,
  },
};

const introSchema = new Schema({
  name: {
    type: String,
    required: true,
  },

  roles: [String],

  description: {
    type: String,
    required: true,
  },

  github: {
    type: String,
    required: true,
  },

  resume: {
    type: String,
    required: true,
  },

  linkedin: {
    type: String,
    required: true,
  },

  twitter: {
    type: String,
    // required: true,
  },

  insta: {
    type: String,
    // required: true,
  },

  facebook: {
    type: String,
    // required: true,
  },
  
  profile_url:{
    type:String,
    required: true
  },
  ...userIdField, // ✅ Added

});

const skillSchema = new Schema({
  title: { type: String, required: true },
  subheading: {
    type: String,
    default:
      "Full Stack Developer 🌊 Skilled in Angular, React, TypeScript, and Micro Frontend Architecture | Over 5 years of hands-on experience",
    maxlength: [200, "Subheading cannot exceed 200 characters"],
   },
  skills: [
    {
      name: { type: String, required: true },
      image: { type: String, required: true },
    },
  ],
  ...userIdField, // ✅ Added
});

const experienceSchema = new Schema({
  id: { type: Number },
  img: { type: String },
  role: { type: String },
  company: { type: String },
  date: { type: String },
  desc: { type: String },
  skills: { type: [String] },
  doc: { type: String },
  subheading: {
    type: String,
    default:
      "Software Engineer 💻 Experienced in working with diverse companies and projects, delivering innovative solutions across Multiple Domains.",
    maxlength: [200, "Subheading cannot exceed 200 characters"],
  },
  ...userIdField, // ✅ Added
});

const educationSchema = new Schema({
  id: { type: Number },
  img: { type: String },
  school: { type: String },
  date: { type: String },
  grade: { type: String },
  desc: { type: String },
  degree: { type: String },
  subheading: {
    type: String,
    default:
      "Lifelong Learner 🎓 My education has been a journey of self-discovery and growth, shaping my technical expertise and problem-solving skills.",
    maxlength: [200, "Subheading cannot exceed 200 characters"],
  },
  ...userIdField, // ✅ Added
});

//  Project Schema for

const memberSchema = new mongoose.Schema({
  name: {
    type: String,
    // required: true,
  },
  img: {
    type: String,
    // required: true,
  },
  linkedin: {
    type: String,
    // required: true,
  },
  github: {
    type: String,
    // required: true,
  },
  ...userIdField, // ✅ Added
});

const projectSchema = new mongoose.Schema({
  id: {
    type: Number,
    // unique: true
  },
  title: {
    type: String,
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    // required: true
  },
  image: {
    type: String,
    // required: true
  },
  tags: {
    type: [String],
    required: true,
  },
  category: {
    type: String,
  },
  github: {
    type: String,
    required: true,
  },
  webapp: {
    type: String,
    // required: true
  },
  subheading: {
    type: String,
    default:
      "Versatile Developer 🚀 Worked on diverse projects including LMS-MSM Unify, GCON, Naukari Job Portal, and E-commerce platforms.",
    maxlength: [200, "Subheading cannot exceed 200 characters"],
  },
  member: [memberSchema], // Array of members
  ...userIdField, // ✅ Added
});

//  All models Exports
module.exports = {
  Intro: mongoose.model("Intros", introSchema),
  Education: mongoose.model("Educations", educationSchema),
  Expereince: mongoose.model("Expereinces", experienceSchema),
  Skill: mongoose.model("Skills", skillSchema),
  Project: mongoose.model("Projects", projectSchema),
};
