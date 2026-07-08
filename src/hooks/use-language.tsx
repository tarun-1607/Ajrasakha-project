import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type LanguageCode =
  | "English"
  | "Hindi"
  | "Kannada"
  | "Tamil"
  | "Telugu"
  | "Marathi"
  | "Bengali"
  | "Gujarati"
  | "Punjabi"
  | "Malayalam";

export interface LanguageInfo {
  code: LanguageCode;
  label: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: "English", label: "English", nativeName: "English" },
  { code: "Hindi", label: "Hindi", nativeName: "हिन्दी" },
  { code: "Marathi", label: "Marathi", nativeName: "मराठी" },
  { code: "Kannada", label: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "Telugu", label: "Telugu", nativeName: "తెలుగు" },
  { code: "Tamil", label: "Tamil", nativeName: "தமிழ்" },
  { code: "Bengali", label: "Bengali", nativeName: "বাংলা" },
  { code: "Gujarati", label: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "Punjabi", label: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { code: "Malayalam", label: "Malayalam", nativeName: "മലയാളം" },
];

const translations: Record<string, Record<string, string>> = {
  English: {
    "dashboard.title": "Dashboard",
    "dashboard.admin": "Admin",
    "dashboard.logout": "Log out",
    "greeting.morning": "Good morning",
    "greeting.afternoon": "Good afternoon",
    "greeting.evening": "Good evening",
    "welcome.back": "Welcome back",
    "welcome.user": "Welcome, {name} 👋",
    "welcome.subtitle": "Ask questions about your crops, soil, weather and government schemes — in your language, any time.",
    "tag.locationNotSet": "Location not set",
    "tag.cropNotSet": "Crop not set",
    "button.askQuestion": "Ask a question",
    "stats.questionsAsked": "Questions Asked",
    "stats.savedConversations": "Saved Conversations",
    "stats.verifiedAnswers": "Verified Answers",
    "crop.cardTitle": "Primary crop",
    "crop.cardDesc": "Personalised advisories are tuned to this crop",
    "crop.language": "Language",
    "crop.askAbout": "Ask about {crop}",
    "profile.cardTitle": "Region & farm profile",
    "profile.cardDesc": "We tune advisories using this information — the more you share, the better the answers.",
    "profile.currentRegion": "Current region",
    "profile.blockVillage": "Block / Village",
    "profile.currentSeason": "Current season",
    "profile.primaryCrop": "Primary crop",
    "profile.soilType": "Soil type",
    "profile.farmSize": "Farm size",
    "profile.irrigation": "Irrigation",
    "profile.language": "Language",
    "actions.title": "Quick actions",
    "actions.ask": "Ask a Question",
    "actions.askDesc": "Start a new chat",
    "actions.history": "View History",
    "actions.historyDesc": "Past conversations",
    "actions.profile": "Profile",
    "actions.profileDesc": "Your account details",
    "actions.schemes": "Govt. Schemes",
    "actions.schemesDesc": "Subsidies & benefits",
    "actions.diagnose": "Diagnose Crop",
    "actions.diagnoseDesc": "Photo → disease + treatment",
    "recent.title": "Recent conversations",
    "recent.desc": "Pick up where you left off",
    "recent.new": "New",
    "recent.none": "No conversations yet. Ask your first question to get started.",
    "recent.askNow": "Ask now",
    "time.justNow": "just now",
    "time.mAgo": "{min}m ago",
    "time.hAgo": "{h}h ago",
    "time.dAgo": "{d}d ago",
    "season.title": "Seasonal advisory",
    "season.tip.kharif": "Ensure proper drainage in fields and monitor for fungal diseases after heavy rains.",
    "season.tip.postMonsoon": "Ideal time to prepare land for Rabi sowing. Test soil moisture before planting.",
    "season.tip.rabi": "Watch for frost on cold nights. Light irrigation in the evening can protect crops.",
    "season.tip.zaid": "Irrigate early morning or late evening to reduce water loss. Mulch to retain soil moisture.",
    "season.name.kharif": "Kharif (Monsoon)",
    "season.name.postMonsoon": "Post-Monsoon",
    "season.name.rabi": "Rabi (Winter)",
    "season.name.zaid": "Zaid (Summer)",
    "season.adv1": "Inspect fields early morning for pest activity.",
    "season.adv2": "Keep records of rainfall and irrigation cycles.",
    "season.adv3": "Apply fertiliser as per soil test recommendations.",
    "season.askAbout": "Ask about this season",
  },
  Hindi: {
    "dashboard.title": "डैशबोर्ड",
    "dashboard.admin": "एडमिन",
    "dashboard.logout": "लॉग आउट",
    "greeting.morning": "सुप्रभात",
    "greeting.afternoon": "नमस्कार",
    "greeting.evening": "शुभ संध्या",
    "welcome.back": "वापसी पर स्वागत है",
    "welcome.user": "स्वागत है, {name} 👋",
    "welcome.subtitle": "अपनी फसलों, मिट्टी, मौसम और सरकारी योजनाओं के बारे में अपनी भाषा में कभी भी प्रश्न पूछें।",
    "tag.locationNotSet": "स्थान निर्धारित नहीं",
    "tag.cropNotSet": "फसल निर्धारित नहीं",
    "button.askQuestion": "सवाल पूछें",
    "stats.questionsAsked": "पूछे गए प्रश्न",
    "stats.savedConversations": "सुरक्षित बातचीत",
    "stats.verifiedAnswers": "सत्यापित उत्तर",
    "crop.cardTitle": "मुख्य फसल",
    "crop.cardDesc": "व्यक्तिगत सलाह इस फसल के अनुसार दी जाती है",
    "crop.language": "भाषा",
    "crop.askAbout": "{crop} के बारे में पूछें",
    "profile.cardTitle": "क्षेत्र और कृषि प्रोफ़ाइल",
    "profile.cardDesc": "हम इस जानकारी का उपयोग करके सलाह को बेहतर बनाते हैं — आप जितनी अधिक जानकारी साझा करेंगे, उतने ही बेहतर उत्तर मिलेंगे।",
    "profile.currentRegion": "वर्तमान क्षेत्र",
    "profile.blockVillage": "ब्लॉक / गाँव",
    "profile.currentSeason": "वर्तमान मौसम",
    "profile.primaryCrop": "मुख्य फसल",
    "profile.soilType": "मिट्टी का प्रकार",
    "profile.farmSize": "खेत का आकार",
    "profile.irrigation": "सिंचाई का प्रकार",
    "profile.language": "भाषा",
    "actions.title": "त्वरित कार्रवाई",
    "actions.ask": "सवाल पूछें",
    "actions.askDesc": "नई बातचीत शुरू करें",
    "actions.history": "इतिहास देखें",
    "actions.historyDesc": "पुरानी बातचीत",
    "actions.profile": "प्रोफ़ाइल",
    "actions.profileDesc": "आपके खाते का विवरण",
    "actions.schemes": "सरकारी योजनाएं",
    "actions.schemesDesc": "अनुदान और लाभ",
    "actions.diagnose": "फसल का निदान",
    "actions.diagnoseDesc": "फोटो → रोग + उपचार",
    "recent.title": "हाल की बातचीत",
    "recent.desc": "जहाँ से आपने छोड़ा था वहीं से शुरू करें",
    "recent.new": "नया",
    "recent.none": "अभी तक कोई बातचीत नहीं हुई है। शुरू करने के लिए अपना पहला प्रश्न पूछें।",
    "recent.askNow": "अभी पूछें",
    "time.justNow": "अभी-अभी",
    "time.mAgo": "{min} मिनट पहले",
    "time.hAgo": "{h} घंटे पहले",
    "time.dAgo": "{d} दिन पहले",
    "season.title": "मौसमी सलाह",
    "season.tip.kharif": "खेतों में जल निकासी की उचित व्यवस्था सुनिश्चित करें और भारी बारिश के बाद फंगल रोगों की निगरानी करें।",
    "season.tip.postMonsoon": "रबी की बुआई के लिए भूमि तैयार करने का उपयुक्त समय। रोपण से पहले मिट्टी की नमी का परीक्षण करें।",
    "season.tip.rabi": "ठंडी रातों में पाले (frost) पर नज़र रखें। शाम के समय हल्की सिंचाई करने से फसल सुरक्षित रह सकती है।",
    "season.tip.zaid": "पानी के नुकसान को कम करने के लिए सुबह जल्दी या देर शाम को सिंचाई करें। नमी बनाए रखने के लिए मल्चिंग करें।",
    "season.name.kharif": "खरीफ (मानसून)",
    "season.name.postMonsoon": "मानसून के बाद",
    "season.name.rabi": "रबी (सर्दियों)",
    "season.name.zaid": "जायद (गर्मी)",
    "season.adv1": "कीटों की गतिविधि के लिए सुबह जल्दी खेतों का निरीक्षण करें।",
    "season.adv2": "वर्षा और सिंचाई चक्रों का रिकॉर्ड रखें।",
    "season.adv3": "मिट्टी परीक्षण की सिफारिशों के अनुसार उर्वरक डालें।",
    "season.askAbout": "इस मौसम के बारे में पूछें",
  },
  Marathi: {
    "dashboard.title": "डॅशबोर्ड",
    "dashboard.admin": "अ‍ॅडमिन",
    "dashboard.logout": "लॉग आउट",
    "greeting.morning": "शुभप्रभात",
    "greeting.afternoon": "नमस्कार",
    "greeting.evening": "शुभ संध्या",
    "welcome.back": "परत आल्याबद्दल स्वागत आहे",
    "welcome.user": "स्वागत आहे, {name} 👋",
    "welcome.subtitle": "तुमची पिके, माती, हवामान आणि सरकारी योजनांबद्दल तुमच्या भाषेत कधीही प्रश्न विचारा.",
    "tag.locationNotSet": "स्थान सेट नाही",
    "tag.cropNotSet": "पीक सेट नाही",
    "button.askQuestion": "प्रश्न विचारा",
    "stats.questionsAsked": "विचारलेले प्रश्न",
    "stats.savedConversations": "जतन केलेली संभाषणे",
    "stats.verifiedAnswers": "सत्यापित उत्तरे",
    "crop.cardTitle": "मुख्य पीक",
    "crop.cardDesc": "वैयक्तिकृत सल्ले या पिकाच्या आधारे दिले जातात",
    "crop.language": "भाषा",
    "crop.askAbout": "{crop} बद्दल विचारा",
    "profile.cardTitle": "प्रांत आणि शेती प्रोफाईल",
    "profile.cardDesc": "आम्ही या माहितीचा वापर करून सल्ले अधिक अचूक करतो — तुम्ही जेवढी जास्त माहिती द्याल, तेवढी उत्तरे चांगली मिळतील.",
    "profile.currentRegion": "सध्याचा प्रांत",
    "profile.blockVillage": "तालुका / गाव",
    "profile.currentSeason": "सध्याचा हंगाम",
    "profile.primaryCrop": "मुख्य पीक",
    "profile.soilType": "मातीचा प्रकार",
    "profile.farmSize": "शेतीचा आकार",
    "profile.irrigation": "सिंचनाचा प्रकार",
    "profile.language": "भाषा",
    "actions.title": "त्वरित कृती",
    "actions.ask": "प्रश्न विचारा",
    "actions.askDesc": "नवीन संभाषण सुरू करा",
    "actions.history": "इतिहास पहा",
    "actions.historyDesc": "मागील संभाषणे",
    "actions.profile": "प्रोफाईल",
    "actions.profileDesc": "तुमच्या खात्याचा तपशील",
    "actions.schemes": "सरकारी योजना",
    "actions.schemesDesc": "अनुदान आणि फायदे",
    "actions.diagnose": "पीक रोग निदान",
    "actions.diagnoseDesc": "फोटो → रोग + उपचार",
    "recent.title": "अलीकडील संभाषणे",
    "recent.desc": "तुम्ही जिथे सोडले होते तिथून पुढे सुरू करा",
    "recent.new": "नवीन",
    "recent.none": "अद्याप कोणतेही संभाषण नाही. सुरू करण्यासाठी तुमचा पहिला प्रश्न विचारा.",
    "recent.askNow": "आता विचारा",
    "time.justNow": "आत्ताच",
    "time.mAgo": "{min} मिनिटांपूर्वी",
    "time.hAgo": "{h} तासांपूर्वी",
    "time.dAgo": "{d} दिवसांपूर्वी",
    "season.title": "हंगामी सल्ला",
    "season.tip.kharif": "शेतात पाण्याचा योग्य निचरा होण्याची खात्री करा आणि जोरदार पावसानंतर बुरशीजन्य रोगांवर लक्ष ठेवा.",
    "season.tip.postMonsoon": "रब्बी पेरणीसाठी जमीन तयार करण्याची योग्य वेळ. पेरणीपूर्वी मातीतील ओलावा तपासा.",
    "season.tip.rabi": "थंड रात्री पिकांचे दव (frost) पासून संरक्षण करा. संध्याकाळी हलके सिंचन केल्याने पिकांचे रक्षण होऊ शकते.",
    "season.tip.zaid": "पाण्याचे बाष्पीभवन कमी करण्यासाठी सकाळी लवकर किंवा संध्याकाळी उशिरा सिंचन करा. ओलावा टिकवून ठेवण्यासाठी आच्छादन (mulch) वापरा.",
    "season.name.kharif": "खरीप (पावसाळा)",
    "season.name.postMonsoon": "पावसाळ्यानंतरचा काळ",
    "season.name.rabi": "रब्बी (हिवाळा)",
    "season.name.zaid": "उन्हाळी हंगाम (झैद)",
    "season.adv1": "किडींच्या प्रादुर्भावासाठी सकाळी लवकर शेताचे निरीक्षण करा.",
    "season.adv2": "पाऊस आणि सिंचन चक्राची नोंद ठेवा.",
    "season.adv3": "माती परीक्षणाच्या शिफारशींनुसार खतांचा वापर करा.",
    "season.askAbout": "या हंगामाबद्दल विचारा",
  },
  Kannada: {
    "dashboard.title": "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
    "dashboard.admin": "ಅಡ್ಮಿನ್",
    "dashboard.logout": "ಲಾಗ್ ಔಟ್",
    "greeting.morning": "ಶುಭೋದಯ",
    "greeting.afternoon": "ನಮಸ್ಕಾರ",
    "greeting.evening": "ಶುಭ ಸಂಜೆ",
    "welcome.back": "ಮರಳಿ ಸ್ವಾಗತ",
    "welcome.user": "ಸ್ವಾಗತ, {name} 👋",
    "welcome.subtitle": "ನಿಮ್ಮ ಬೆಳೆಗಳು, ಮಣ್ಣು, ಹವಾಮಾನ ಮತ್ತು ಸರ್ಕಾರಿ ಯೋಜನೆಗಳ ಬಗ್ಗೆ ನಿಮ್ಮದೇ ಭಾಷೆಯಲ್ಲಿ ಯಾವಾಗ ಬೇಕಾದರೂ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ.",
    "tag.locationNotSet": "ಸ್ಥಳ ಹೊಂದಿಸಿಲ್ಲ",
    "tag.cropNotSet": "ಬೆಳೆ ಹೊಂದಿಸಿಲ್ಲ",
    "button.askQuestion": "ಪ್ರಶ್ನೆ ಕೇಳಿ",
    "stats.questionsAsked": "ಕೇಳಲಾದ ಪ್ರಶ್ನೆಗಳು",
    "stats.savedConversations": "ಉಳಿಸಲಾದ ಸಂಭಾಷಣೆಗಳು",
    "stats.verifiedAnswers": "ಪರಿಶೀಲಿಸಿದ ಉತ್ತರಗಳು",
    "crop.cardTitle": "ಮುಖ್ಯ ಬೆಳೆ",
    "crop.cardDesc": "ವೈಯಕ್ತಿಕಗೊಳಿಸಿದ ಸಲಹೆಗಳನ್ನು ಈ ಬೆಳೆಗೆ ಅನುಗುಣವಾಗಿ ನೀಡಲಾಗುತ್ತದೆ",
    "crop.language": "ಭಾಷೆ",
    "crop.askAbout": "{crop} ಬಗ್ಗೆ ಕೇಳಿ",
    "profile.cardTitle": "ಪ್ರದೇಶ ಮತ್ತು ಕೃಷಿ ಪ್ರೊಫೈಲ್",
    "profile.cardDesc": "ನಾವು ಈ ಮಾಹಿತಿಯನ್ನು ಬಳಸಿಕೊಂಡು ಸಲಹೆಗಳನ್ನು ಉತ್ತಮಗೊಳಿಸುತ್ತೇವೆ — ನೀವು ಹೆಚ್ಚು ವಿವರಗಳನ್ನು ಹಂಚಿಕೊಂಡಷ್ಟೂ ಉತ್ತಮ ಉತ್ತರಗಳು ಸಿಗುತ್ತವೆ.",
    "profile.currentRegion": "ಪ್ರಸ್ತುತ ಪ್ರದೇಶ",
    "profile.blockVillage": "ಹೋಬಳಿ / ಗ್ರಾಮ",
    "profile.currentSeason": "ಪ್ರಸ್ತುತ ಹಂಗಾಮು",
    "profile.primaryCrop": "ಮುಖ್ಯ ಬೆಳೆ",
    "profile.soilType": "ಮಣ್ಣಿನ ವಿಧ",
    "profile.farmSize": "ಜಮೀನಿನ ಜಾಗ",
    "profile.irrigation": "ನೀರಾವರಿ ವಿಧ",
    "profile.language": "ಭಾಷೆ",
    "actions.title": "ತ್ವರಿತ ಕ್ರಮಗಳು",
    "actions.ask": "ಪ್ರಶ್ನೆ ಕೇಳಿ",
    "actions.askDesc": "ಹೊಸ ಚಾಟ್ ಪ್ರಾರಂಭಿಸಿ",
    "actions.history": "ಇತಿಹಾಸ ನೋಡಿ",
    "actions.historyDesc": "ಹಿಂದಿನ ಸಂಭಾಷಣೆಗಳು",
    "actions.profile": "ಪ್ರೊಫೈಲ್",
    "actions.profileDesc": "ನಿಮ್ಮ ಖಾತೆಯ ವಿವರಗಳು",
    "actions.schemes": "ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು",
    "actions.schemesDesc": "ಸಹಾಯಧನ ಮತ್ತು ಪ್ರಯೋಜನಗಳು",
    "actions.diagnose": "ಬೆಳೆ ರೋಗ ಪತ್ತೆ",
    "actions.diagnoseDesc": "ಫೋಟೋ → ರೋಗ + ಚಿಕಿತ್ಸೆ",
    "recent.title": "ಇತ್ತೀಚಿನ ಸಂಭಾಷಣೆಗಳು",
    "recent.desc": "ನೀವು ನಿಲ್ಲಿಸಿದ ಸ್ಥಳದಿಂದ ಮುಂದುವರಿಸಿ",
    "recent.new": "ಹೊಸದು",
    "recent.none": "ಇನ್ನೂ ಯಾವುದೇ ಸಂಭಾಷಣೆಗಳಿಲ್ಲ. ಪ್ರಾರಂಭಿಸಲು ನಿಮ್ಮ ಮೊದಲ ಪ್ರಶ್ನೆಯನ್ನು ಕೇಳಿ.",
    "recent.askNow": "ಈಗಲೇ ಕೇಳಿ",
    "time.justNow": "ಈಗ ತಾನೇ",
    "time.mAgo": "{min} ನಿಮಿಷಗಳ ಹಿಂದೆ",
    "time.hAgo": "{h} ಗಂಟೆಗಳ ಹಿಂದೆ",
    "time.dAgo": "{d} ದಿನಗಳ ಹಿಂದೆ",
    "season.title": "ಹಂಗಾಮು ಸಲಹೆ",
    "season.tip.kharif": "ಜಮೀನಿನಲ್ಲಿ ನೀರು ಸರಾಗವಾಗಿ ಹರಿದು ಹೋಗಲು ಸೂಕ್ತ ವ್ಯವಸ್ಥೆ ಮಾಡಿ ಮತ್ತು ಭಾರೀ ಮಳೆಯ ನಂತರ ಶಿಲೀಂಧ್ರ ರೋಗಗಳ ಬಗ್ಗೆ ನಿಗา ಇರಿಸಿ.",
    "season.tip.postMonsoon": "ರಬಿ ಬಿತ್ತನೆಗಾಗಿ ಜಮೀನು ಸಿದ್ಧಪಡಿಸಲು ಸೂಕ್ತ ಸಮಯ. ಬಿತ್ತನೆಗೆ ಮುನ್ನ ಮಣ್ಣಿನ ತೇವಾಂಶವನ್ನು ಪರೀಕ್ಷಿಸಿ.",
    "season.tip.rabi": "ಚಳಿಯ ರಾತ್ರಿಗಳಲ್ಲಿ ಮಂಜು ಮುಸುಕುವಿಕೆ ಬಗ್ಗೆ ಎಚ್ಚರವಿರಲಿ. ಸಂಜೆ ವೇಳೆ ಹಗುರ ನೀರಾವರಿ ಮಾಡುವುದರಿಂದ ಬೆಳೆಗಳನ್ನು ರಕ್ಷಿಸಬಹುದು.",
    "season.tip.zaid": "ನೀರಿನ ನಷ್ಟವನ್ನು ಕಡಿಮೆ ಮಾಡಲು ಮುಂಜಾನೆ ಅಥವಾ ಸಂಜೆ ತಡವಾಗಿ ನೀರಾವರಿ ಮಾಡಿ. ತೇವಾಂಶ ಉಳಿಸಿಕೊಳ್ಳಲು ಒಣಹುಲ್ಲು ಹೊದಿಕೆ (mulch) ಬಳಸಿ.",
    "season.name.kharif": "ಖಾರಿಫ್ (ಮುಂಗಾರು)",
    "season.name.postMonsoon": "ಮುಂಗಾರು ನಂತರದ ಹಂಗಾಮು",
    "season.name.rabi": "ರಬಿ (ಹಿಂಗಾರು)",
    "season.name.zaid": "ಜೈದ್ (ಬೇಸಿಗೆ)",
    "season.adv1": "ಕೀಟಗಳ ಕಾಟವನ್ನು ಪರೀಕ್ಷಿಸಲು ಮುಂಜಾನೆ ಜಮೀನಿನ ಪರಿಶೀಲನೆ ನಡೆಸಿ.",
    "season.adv2": "ಮಳೆ ಮತ್ತು ನೀರಾವರಿ ಚಕ್ರಗಳ ದಾಖಲೆ ಇರಿಸಿ.",
    "season.adv3": "ಮಣ್ಣಿನ ಪರೀಕ್ಷೆಯ ಶಿಫಾರಸಿನಂತೆ ರಸಗೊಬ್ಬರವನ್ನು ಬಳಸಿ.",
    "season.askAbout": "ಈ ಹಂಗಾಮಿನ ಬಗ್ಗೆ ಕೇಳಿ",
  },
};

interface LanguageContextProps {
  language: LanguageCode;
  changeLanguage: (lang: LanguageCode) => Promise<void>;
  t: (key: string, replacements?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<LanguageCode>("English");

  // Load language preference from local storage and database on init
  useEffect(() => {
    const savedLanguage = localStorage.getItem("preferred_language") as LanguageCode | null;
    if (savedLanguage && SUPPORTED_LANGUAGES.some((l) => l.code === savedLanguage)) {
      setLanguage(savedLanguage);
    }

    // Fetch and sync preferred language from user profile
    const syncProfileLanguage = async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("preferred_language")
          .eq("id", user.id)
          .maybeSingle();

        if (data?.preferred_language && SUPPORTED_LANGUAGES.some((l) => l.code === data.preferred_language)) {
          setLanguage(data.preferred_language as LanguageCode);
          localStorage.setItem("preferred_language", data.preferred_language);
        }
      }
    };

    syncProfileLanguage();

    // Listen for auth state change to sync language if a new user logs in
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const { data } = await supabase
          .from("profiles")
          .select("preferred_language")
          .eq("id", session.user.id)
          .maybeSingle();

        if (data?.preferred_language && SUPPORTED_LANGUAGES.some((l) => l.code === data.preferred_language)) {
          setLanguage(data.preferred_language as LanguageCode);
          localStorage.setItem("preferred_language", data.preferred_language);
        }
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);


  const changeLanguage = async (newLang: LanguageCode) => {
    setLanguage(newLang);
    localStorage.setItem("preferred_language", newLang);

    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({ preferred_language: newLang })
          .eq("id", user.id);

        if (error) {
          console.error("Error updating preferred language in database:", error.message);
        } else {
          toast.success(`Language changed to ${newLang}`);
        }
      }
    } catch (err) {
      console.error("Failed to sync language preference:", err);
    }
  };

  const t = (key: string, replacements?: Record<string, string>): string => {
    const dict = translations[language] || translations["English"];
    let val = dict[key] || translations["English"][key] || key;

    if (replacements) {
      Object.entries(replacements).forEach(([k, v]) => {
        val = val.replace(`{${k}}`, v);
      });
    }

    return val;
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
