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
    "pf.title": "Farmer Profile",
    "pf.back": "Back to Dashboard",
    "pf.personal.title": "Personal Information",
    "pf.personal.desc": "Update your contact info and location details",
    "pf.personal.name": "Full Name",
    "pf.personal.name.req": "Full Name *",
    "pf.personal.name.placeholder": "Enter your full name",
    "pf.personal.phone": "Mobile Number",
    "pf.personal.phone.placeholder": "e.g. +91 98765 43210",
    "pf.personal.email": "Email (Account ID)",
    "pf.personal.dob": "Date of Birth",
    "pf.personal.gender": "Gender",
    "pf.personal.lang": "Preferred Language",
    "pf.personal.locTitle": "Location Details",
    "pf.personal.state": "State",
    "pf.personal.state.req": "State *",
    "pf.personal.state.placeholder": "e.g. Karnataka",
    "pf.personal.district": "District",
    "pf.personal.district.req": "District *",
    "pf.personal.district.placeholder": "e.g. Mysuru",
    "pf.personal.block": "Block / Taluk",
    "pf.personal.block.placeholder": "e.g. Nanjangud",
    "pf.personal.village": "Village",
    "pf.personal.village.placeholder": "e.g. Hadinaru",
    "pf.farm.title": "Farm Information",
    "pf.farm.desc": "Tell us about your crops and agricultural methods",
    "pf.farm.primary": "Primary Crop",
    "pf.farm.secondary": "Secondary Crop",
    "pf.farm.size": "Farm Size",
    "pf.farm.size.placeholder": "e.g. 3 Acres, 1.5 Hectares",
    "pf.farm.exp": "Years of Experience",
    "pf.farm.exp.placeholder": "e.g. 10",
    "pf.farm.soil": "Soil Type",
    "pf.farm.irrigation": "Irrigation Type",
    "pf.farm.method": "Farming Method",
    "pf.farm.season": "Current Season",
    "pf.pref.title": "Preferences & Alert Settings",
    "pf.pref.desc": "Choose how you want to receive intelligence and advisories",
    "pf.pref.weather": "Weather Warnings & Alerts",
    "pf.pref.weather.desc": "Receive instant notifications about rain storms, heat waves, or frost hazards.",
    "pf.pref.sms": "SMS Notifications",
    "pf.pref.sms.desc": "Receive critical pest alerts and watering reminders directly on your mobile.",
    "pf.pref.email": "Weekly Email Summaries",
    "pf.pref.email.desc": "Get a structured report of crop diagnosis history, market prices, and soil advisories.",
    "pf.pref.push": "App Push Notifications",
    "pf.pref.push.desc": "Allow the browser to show real-time advisor responses and system updates.",
    "pf.about.namePlaceholder": "Farmer Name",
    "pf.about.locNotConfig": "Location not configured",
    "pf.about.bio": "Bio / About the Farmer",
    "pf.about.bio.placeholder": "Describe your farm, history, or objectives...",
    "pf.about.fav": "Favourite Crops to Grow",
    "pf.about.fav.placeholder": "e.g. Basmati Rice, Red Potatoes, Alphonso Mango",
    "pf.about.upload": "Upload Photo",
    "pf.coord.title": "Farm Field Coordinates",
    "pf.coord.desc": "Define field coordinates to sync satellite weather models",
    "pf.coord.gps": "Use My GPS",
    "pf.coord.lat": "Latitude",
    "pf.coord.lng": "Longitude",
    "pf.cal.title": "Crop Calendar Advisory",
    "pf.cal.desc": "Sowing, growth, and harvest timelines based on crop selections",
    "pf.cal.primary": "Primary: {crop}",
    "pf.cal.secondary": "Secondary: {crop}",
    "pf.cal.active": "Active",
    "pf.cal.planned": "Planned",
    "pf.cal.sow": "Sowing",
    "pf.cal.grow": "Growth",
    "pf.cal.harvest": "Harvest",
    "pf.cal.seasonal": "Seasonal",
    "pf.cal.varies": "Varies",
    "pf.cal.harvestSec": "Harvest season",
    "pf.save.info": "By saving, your farm profile is compiled for localized seasonal advisory insights. Email and notifications preference triggers update automatically.",
    "pf.save.btn": "Save Farm Profile",
    "pf.save.busy": "Saving Profiles...",
    "pf.load.busy": "Loading your profile...",
    "pf.toast.gps.fetching": "Fetching GPS coordinates...",
    "pf.toast.gps.success": "GPS Location retrieved successfully!",
    "pf.toast.gps.failed": "GPS Lookup Failed: {error}",
    "pf.toast.gps.unsupported": "Geolocation is not supported by your browser",
    "pf.toast.photo.type": "Please upload an image file",
    "pf.toast.photo.size": "Image file is too large. Max limit is 2MB.",
    "pf.toast.photo.success": "Farm photo selected!",
    "pf.toast.session.expired": "User session expired. Please sign in again.",
    "pf.toast.val.name": "Full Name is required",
    "pf.toast.val.state": "State is required",
    "pf.toast.val.district": "District is required",
    "pf.toast.save.success": "Profile saved successfully!",
    "pf.toast.load.failed": "Failed to load profile data",
    "pf.toast.save.failed": "Failed to update profile",
    "gender.Male": "Male",
    "gender.Female": "Female",
    "gender.Other": "Other",
    "gender.Prefer not to say": "Prefer not to say",
    "season.Kharif": "Kharif",
    "season.Rabi": "Rabi",
    "season.Zaid": "Zaid",
    "season.Year-round": "Year-round",
    "method.Organic": "Organic",
    "method.Conventional": "Conventional",
    "method.Natural Farming": "Natural Farming",
    "method.Precision Farming": "Precision Farming",
    "method.Mixed Farming": "Mixed Farming",
    "method.Other": "Other",
    "irrigation.Rain-fed": "Rain-fed",
    "irrigation.Drip Irrigation": "Drip Irrigation",
    "irrigation.Sprinkler Irrigation": "Sprinkler Irrigation",
    "irrigation.Canal Irrigation": "Canal Irrigation",
    "irrigation.Borewell / Well": "Borewell / Well",
    "irrigation.Mixed": "Mixed",
    "irrigation.Other": "Other",
    "soil.Alluvial": "Alluvial",
    "soil.Black": "Black",
    "soil.Red": "Red",
    "soil.Laterite": "Laterite",
    "soil.Desert/Sandy": "Desert/Sandy",
    "soil.Clayey": "Clayey",
    "soil.Loamy": "Loamy",
    "soil.Other": "Other",
    "crop.Rice": "Rice",
    "crop.Wheat": "Wheat",
    "crop.Maize": "Maize",
    "crop.Cotton": "Cotton",
    "crop.Sugarcane": "Sugarcane",
    "crop.Pulses": "Pulses",
    "crop.Vegetables": "Vegetables",
    "crop.Fruits": "Fruits",
    "crop.Coffee": "Coffee",
    "crop.Tea": "Tea",
    "crop.Mustard": "Mustard",
    "crop.Soybean": "Soybean",
    "crop.Millets": "Millets",
    "crop.Other": "Other",
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
    "pf.title": "किसान प्रोफ़ाइल",
    "pf.back": "डैशबोर्ड पर वापस जाएं",
    "pf.personal.title": "व्यक्तिगत जानकारी",
    "pf.personal.desc": "अपनी संपर्क जानकारी और स्थान विवरण अपडेट करें",
    "pf.personal.name": "पूरा नाम",
    "pf.personal.name.req": "पूरा नाम *",
    "pf.personal.name.placeholder": "अपना पूरा नाम दर्ज करें",
    "pf.personal.phone": "मोबाइल नंबर",
    "pf.personal.phone.placeholder": "जैसे: +91 98765 43210",
    "pf.personal.email": "ईमेल (खाता आईडी)",
    "pf.personal.dob": "जन्म तिथि",
    "pf.personal.gender": "लिंग",
    "pf.personal.lang": "पसंदीदा भाषा",
    "pf.personal.locTitle": "स्थान विवरण",
    "pf.personal.state": "राज्य",
    "pf.personal.state.req": "राज्य *",
    "pf.personal.state.placeholder": "जैसे: कर्नाटक",
    "pf.personal.district": "जिला",
    "pf.personal.district.req": "जिला *",
    "pf.personal.district.placeholder": "जैसे: मैसूर",
    "pf.personal.block": "ब्लॉक / तालुका",
    "pf.personal.block.placeholder": "जैसे: नंजनगुड़",
    "pf.personal.village": "गाँव",
    "pf.personal.village.placeholder": "जैसे: हादीनारु",
    "pf.farm.title": "कृषि जानकारी",
    "pf.farm.desc": "अपनी फसलों और कृषि पद्धतियों के बारे में बताएं",
    "pf.farm.primary": "मुख्य फसल",
    "pf.farm.secondary": "सहायक फसल",
    "pf.farm.size": "खेत का आकार",
    "pf.farm.size.placeholder": "जैसे: 3 एकड़, 1.5 हेक्टेयर",
    "pf.farm.exp": "अनुभव (वर्षों में)",
    "pf.farm.exp.placeholder": "जैसे: 10",
    "pf.farm.soil": "मिट्टी का प्रकार",
    "pf.farm.irrigation": "सिंचाई का प्रकार",
    "pf.farm.method": "खेती की विधि",
    "pf.farm.season": "वर्तमान मौसम",
    "pf.pref.title": "प्राथमिकताएं और अलर्ट सेटिंग्स",
    "pf.pref.desc": "चुनें कि आप कृषि सलाह और अलर्ट कैसे प्राप्त करना चाहते हैं",
    "pf.pref.weather": "मौसम चेतावनी और अलर्ट",
    "pf.pref.weather.desc": "तूफान, लू या पाले के खतरों के बारे में तुरंत सूचनाएं प्राप्त करें।",
    "pf.pref.sms": "एसएमएस सूचनाएं",
    "pf.pref.sms.desc": "कीटों के गंभीर अलर्ट और सिंचाई अनुस्मारक सीधे अपने मोबाइल पर प्राप्त करें।",
    "pf.pref.email": "साप्ताहिक ईमेल सारांश",
    "pf.pref.email.desc": "फसल निदान इतिहास, बाजार मूल्य और मृदा सलाह की एक व्यवस्थित रिपोर्ट प्राप्त करें।",
    "pf.pref.push": "ऐप पुश सूचनाएं",
    "pf.pref.push.desc": "ब्राउज़र को वास्तविक समय में सलाहकारों के जवाब और सिस्टम अपडेट दिखाने की अनुमति दें।",
    "pf.about.namePlaceholder": "किसान का नाम",
    "pf.about.locNotConfig": "स्थान निर्धारित नहीं है",
    "pf.about.bio": "बायो / किसान के बारे में",
    "pf.about.bio.placeholder": "अपने खेत, इतिहास या लक्ष्यों का वर्णन करें...",
    "pf.about.fav": "उगाने के लिए पसंदीदा फसलें",
    "pf.about.fav.placeholder": "जैसे: बासमती चावल, लाल आलू, अल्फांसो आम",
    "pf.about.upload": "फोटो अपलोड करें",
    "pf.coord.title": "खेत के निर्देशांक (Coordinates)",
    "pf.coord.desc": "सैटेलाइट मौसम मॉडल को सिंक करने के लिए खेत के निर्देशांक परिभाषित करें",
    "pf.coord.gps": "मेरे जीपीएस का उपयोग करें",
    "pf.coord.lat": "अक्षांश (Latitude)",
    "pf.coord.lng": "रेखांश (Longitude)",
    "pf.cal.title": "फसल कैलेंडर सलाह",
    "pf.cal.desc": "फसल चयन के आधार पर बुआई, विकास और कटाई की समयसीमा",
    "pf.cal.primary": "मुख्य: {crop}",
    "pf.cal.secondary": "सहायक: {crop}",
    "pf.cal.active": "सक्रिय",
    "pf.cal.planned": "योजित",
    "pf.cal.sow": "बुआई",
    "pf.cal.grow": "विकास",
    "pf.cal.harvest": "कटाई",
    "pf.cal.seasonal": "मौसमी",
    "pf.cal.varies": "परिवर्तित",
    "pf.cal.harvestSec": "कटाई का मौसम",
    "pf.save.info": "सहेजने पर, आपकी कृषि प्रोफ़ाइल को स्थानीय मौसमी सलाह के लिए संकलित किया जाता है। ईमेल और सूचनाओं की प्राथमिकताएं स्वचालित रूप से अपडेट हो जाती हैं।",
    "pf.save.btn": "कृषि प्रोफ़ाइल सहेजें",
    "pf.save.busy": "प्रोफ़ाइल सहेजी जा रही है...",
    "pf.load.busy": "आपकी प्रोफ़ाइल लोड हो रही है...",
    "pf.toast.gps.fetching": "जीपीएस निर्देशांक प्राप्त किए जा रहे हैं...",
    "pf.toast.gps.success": "जीपीएस स्थान सफलतापूर्वक प्राप्त किया गया!",
    "pf.toast.gps.failed": "जीपीएस खोज विफल रही: {error}",
    "pf.toast.gps.unsupported": "आपका ब्राउज़र जियोलोकेशन का समर्थन नहीं करता है",
    "pf.toast.photo.type": "कृपया एक छवि फ़ाइल अपलोड करें",
    "pf.toast.photo.size": "छवि फ़ाइल बहुत बड़ी है। अधिकतम सीमा 2MB है।",
    "pf.toast.photo.success": "खेत की फोटो चुनी गई!",
    "pf.toast.session.expired": "उपयोगकर्ता सत्र समाप्त हो गया। कृपया फिर से साइन इन करें।",
    "pf.toast.val.name": "पूरा नाम आवश्यक है",
    "pf.toast.val.state": "राज्य आवश्यक है",
    "pf.toast.val.district": "जिला आवश्यक है",
    "pf.toast.save.success": "प्रोफ़ाइल सफलतापूर्वक सहेजी गई!",
    "pf.toast.load.failed": "प्रोफ़ाइल डेटा लोड करने में विफल",
    "pf.toast.save.failed": "प्रोफ़ाइल अपडेट करने में विफल",
    "gender.Male": "पुरुष",
    "gender.Female": "महिला",
    "gender.Other": "अन्य",
    "gender.Prefer not to say": "बताना नहीं चाहते",
    "season.Kharif": "खरीफ",
    "season.Rabi": "रबी",
    "season.Zaid": "जायद",
    "season.Year-round": "पूरे साल",
    "method.Organic": "जैविक",
    "method.Conventional": "पारंपरिक",
    "method.Natural Farming": "प्राकृतिक खेती",
    "method.Precision Farming": "सटीक खेती",
    "method.Mixed Farming": "मिश्रित खेती",
    "method.Other": "अन्य",
    "irrigation.Rain-fed": "वर्षा-आधारित",
    "irrigation.Drip Irrigation": "टपक सिंचाई (ड्रिप)",
    "irrigation.Sprinkler Irrigation": "छिड़काव सिंचाई (स्प्रिंकलर)",
    "irrigation.Canal Irrigation": "नहर सिंचाई",
    "irrigation.Borewell / Well": "नलकूप / कुआं",
    "irrigation.Mixed": "मिश्रित",
    "irrigation.Other": "अन्य",
    "soil.Alluvial": "जलोढ़ (Alluvial)",
    "soil.Black": "काली (Black)",
    "soil.Red": "लाल (Red)",
    "soil.Laterite": "लेटराइट (Laterite)",
    "soil.Desert/Sandy": "रेतीली / मरुस्थलीय",
    "soil.Clayey": "चिकनी मिट्टी (Clayey)",
    "soil.Loamy": "दोमट (Loamy)",
    "soil.Other": "अन्य",
    "crop.Rice": "धान (चावल)",
    "crop.Wheat": "गेहूं",
    "crop.Maize": "मक्का",
    "crop.Cotton": "कपास",
    "crop.Sugarcane": "गन्ना",
    "crop.Pulses": "दालें",
    "crop.Vegetables": "सब्जियां",
    "crop.Fruits": "फल",
    "crop.Coffee": "कॉफ़ी",
    "crop.Tea": "चाय",
    "crop.Mustard": "सरसों",
    "crop.Soybean": "सोयाबीन",
    "crop.Millets": "बाजरा / मोटा अनाज",
    "crop.Other": "अन्य",
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
