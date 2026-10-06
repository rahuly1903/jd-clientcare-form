const mongoose = require("mongoose");

const formDataSchema = new mongoose.Schema({
  formType: {
    type: String,
    default: "",
  },
  formData: {
    type: Object,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("FormData", formDataSchema);
