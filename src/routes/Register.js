require("dotenv").config();
const express = require("express");
const router = new express.Router();
const User = require("../models/registers");
const checkAuth = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const dotenvFlow = require("dotenv-flow");
const authrizeRoles = require("../middleware/rolesMiddleware");
dotenvFlow.config();
const ejs = require("ejs");
const path = require("path");
const fs = require("fs");

const emailSendUser = async (toEmail, hed_Title, apiBaseUrl, templateName, context) => {
  try {
    const transporterEmail = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
      },
    });

    // 🔧 Resolve template from /src/templates
    const templatePath = path.resolve(__dirname, "../templates", `${templateName}.ejs`);
    // console.log("Resolved template path:", templatePath);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }
    const htmlContent = await ejs.renderFile(templatePath, context || {});
    const mailOptions = {
      from: process.env.EMAIL,
      to: toEmail,
      subject: hed_Title,
      html: htmlContent,
    };

    const emailSend = await transporterEmail.sendMail(mailOptions);
    // console.log("Email sent:", emailSend);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

router.post("/register", async (req, res) => {
  try {
    const pass = req.body.password;
    const { email } = req.body;
    const userExist =  await User.findOne({email:email});
    if(userExist){
      return res.status(400).json({message:"User is Already Exists."})
    }
    const hashPassword = await bcrypt.hash(pass, 10);
    const userRegistion = new User({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      gender: req.body.gender,
      phone_Number: req.body.phone_Number,
      roles: req.body.roles,
      password: hashPassword,
    });
    const savedb = await userRegistion.save();
    // console.log("Register data ", savedb);
    const apiBaseUrl = `${process.env.APIBASEURL}api/v1/email-verify/${userRegistion._id}`;
    await emailSendUser(
      userRegistion.email,"Verify your email",apiBaseUrl,"verifyEmail",{
        name: req.body.firstName + req.body.lastName,
        apiBaseUrl: apiBaseUrl,
        logoUrl: process.env.COMPANY_LOGO_URL,
      }
    );
    res.status(201).send({
      success: true,
      message: "Check Your Email Register Link Sent it",
      resetUrl: apiBaseUrl,
      data: savedb
    });
  
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error", Error:error});
  }
})


router.get("/email-verify/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const verify_User = await User.findOne({_id: id});
    // console.log('Verfiy user', verify_User)
    if(!verify_User){
      return res.status(404).json({message:" User is Not Found"});
    }
    if(verify_User.isVerified){
      return res.status(404).json({message:" User Already is Verified"});
    }
    verify_User.isVerified = true;
    await verify_User.save();
    res.json({success:true, message:"User Verified Successfully"})
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error", Error:error});
  }
});


router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email });
    if (!user) {
      return res .status(401).json({ message: "Auth failed Invalid User Name & Password" });
    }
    const isPassEqual = await bcrypt.compare(password, user.password);
    if (!isPassEqual) {
      return res.status(401).json({ message: "Auth failed Invalid User Name & Password" });
    }
    const data = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      gender: user.gender,
      phone_Number: user.phone_Number,
      isVerified: user.isVerified,
      roles: user.roles
    };
    // console.log("Secret Key", process.env.JWT_SECRET);
    const token = jwt.sign(data, process.env.JWT_SECRET, { expiresIn: "1h" });
    // console.log("Modify Data Login", token,data);
    return res.status(200).json({
      success: true,
      message: "Login Successfully",
      userData: {
        data,
        token,
      },
    });
  } catch (error) {
    console.log("login error", error);
    res.status(400).send({
      success: false,
      message: "Invalid Login Details",
      Error: error,
    });
  }
});



// router.get("/user-profile" ,async (req, res) => {
// // router.get("/user-profile", checkAuth, authrizeRoles("ADMIN","USER"), async (req, res) => {
//   try {
//     const userId =req.user.id;
//     console.log("User Id", userId);

//     const users = await User.findById({id:userId}, { password: 0});
//     console.log('user-profile',users,userId)
//     console.log("All users", users);
//     res.status(200).send({
//       success: true,
//       message: "get User-profile Deatils",
//       data: users,
//     });
//   } catch (error) {
//     res.status(500).send({
//       success: false,
//       message: "User-profile Details Not Found",
//       data: [],
//     });
//   }
// });


router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email: email });
    if (!user) {
      return res.status(400).send({ message: "User is Not Found ?" });
    }
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
  // console.log("Email user ",user)
    const apiBaseUrl = `${process.env.APIBASEURL}api/v1/reset-password/${token}`;
    const emailSend = await emailSendUser(
      user.email,"Forgot Password Succefully",apiBaseUrl,"forgotPassword",
      {
        name: user.firstName +''+ user.lastName,
        apiBaseUrl: apiBaseUrl,
        logoUrl: process.env.COMPANY_LOGO_URL,
      }
    );
    // console.log("Email send", emailSend);
    res.status(200).send({
      success: true,
      message: "Please Check Your Email id Link is Shared",
      // resetUrl: emailSend,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Error", error });
  }
});

router.put("/reset-password/:token", async (req, res) => {
  const token = req.params.token;
  const { password } = req.body;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    const users = await User.findById(payload._id);
    // console.log("reset user pass", users, payload._id);
    if (!users) {
      return res.status(400).json({ message: "User is Not Found." });
    }
    const hashPassword = await bcrypt.hash(password, 10);
    users.password = hashPassword;
    await users.save();
    res.status(200).json({ message: "Password Reset Succefully." });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", Error: error });
  }
});


router.get("/all-users", async (req, res) => {
  try {
    const users = await User.find({}, { password: 0, confirm_password: 0 });
    // console.log("All users", users);
    res.status(200).send({
      success: true,
      message: "get All Users Deatils",
      data: users,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Users Deatils Not Found",
      data: [],
    });
  }
});


module.exports = router;

