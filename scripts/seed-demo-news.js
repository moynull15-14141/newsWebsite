#!/usr/bin/env node
/**
 * Populates 15 demo news stories, each published in both Bangla and English (30 articles total, linked
 * as translation pairs), so the site has real-looking content to browse while there's no real editorial
 * content yet.
 *
 * This is placeholder/demo content, not real news — every article is tagged "demo-content" (bn: "ডেমো
 * কন্টেন্ট") and every slug is prefixed `demo-`, specifically so it can be found and deleted in one shot
 * before going live. See scripts/delete-demo-news.js for the matching cleanup script.
 *
 * Safe to re-run: every write is an upsert keyed by slug.
 */
require('dotenv').config();
const { PrismaClient, ArticleStatus } = require('@prisma/client');
const prisma = new PrismaClient();

const DEMO_TAG_SLUG = 'demo-content';

const doc = (paragraphs) => ({
  type: 'doc',
  content: paragraphs.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
});

// One story per existing category, each written once in English and once in Bangla (same story).
const STORIES = [
  {
    slug: 'govt-digital-id-rollout',
    category: 'bangladesh',
    location: 'dhaka',
    en: {
      title: 'Government Announces Nationwide Digital ID Rollout',
      excerpt: 'A new national digital identity system will begin phased rollout next month, officials say, aiming to simplify access to public services.',
      body: [
        'The government has announced a phased nationwide rollout of a new digital identity system, starting next month in Dhaka before expanding to other divisions.',
        'Officials said the system is designed to simplify access to public services such as banking, healthcare, and welfare programs by linking them to a single verified digital ID.',
      ],
    },
    bn: {
      title: 'সারাদেশে ডিজিটাল পরিচয়পত্র চালুর ঘোষণা সরকারের',
      excerpt: 'আগামী মাস থেকে ধাপে ধাপে নতুন জাতীয় ডিজিটাল পরিচয়পত্র ব্যবস্থা চালু হবে বলে জানিয়েছেন কর্মকর্তারা, যার লক্ষ্য জনসেবা সহজ করা।',
      body: [
        'সরকার সারাদেশে নতুন ডিজিটাল পরিচয়পত্র ব্যবস্থা ধাপে ধাপে চালুর ঘোষণা দিয়েছে, যা আগামী মাসে ঢাকা থেকে শুরু হয়ে পরে অন্যান্য বিভাগে সম্প্রসারিত হবে।',
        'কর্মকর্তারা জানিয়েছেন, এই ব্যবস্থাটি ব্যাংকিং, স্বাস্থ্যসেবা ও কল্যাণমূলক কর্মসূচির মতো সরকারি সেবাগুলোকে একটি যাচাইকৃত ডিজিটাল পরিচয়ের সঙ্গে যুক্ত করে সহজলভ্য করার লক্ষ্যে তৈরি।',
      ],
    },
  },
  {
    slug: 'dhaka-climate-summit',
    category: 'world',
    location: 'dhaka',
    en: {
      title: 'Dhaka Hosts Regional Climate Summit With South Asian Leaders',
      excerpt: 'Delegates from across South Asia gathered in Dhaka this week to discuss joint action on flooding, coastal erosion, and climate financing.',
      body: [
        'Dhaka this week hosted a two-day regional climate summit, bringing together delegates from across South Asia to discuss joint action on flooding, coastal erosion, and climate financing.',
        'The summit closed with a joint statement calling for a shared early-warning network for river flooding and cyclones across the region.',
      ],
    },
    bn: {
      title: 'দক্ষিণ এশিয়ার নেতাদের নিয়ে ঢাকায় আঞ্চলিক জলবায়ু সম্মেলন',
      excerpt: 'বন্যা, উপকূলীয় ভাঙন ও জলবায়ু অর্থায়ন নিয়ে যৌথ পদক্ষেপ আলোচনায় এই সপ্তাহে ঢাকায় জড়ো হন দক্ষিণ এশিয়ার প্রতিনিধিরা।',
      body: [
        'এই সপ্তাহে ঢাকায় দুই দিনব্যাপী আঞ্চলিক জলবায়ু সম্মেলন অনুষ্ঠিত হয়েছে, যেখানে দক্ষিণ এশিয়া জুড়ে বন্যা, উপকূলীয় ভাঙন ও জলবায়ু অর্থায়ন নিয়ে যৌথ পদক্ষেপ নিয়ে আলোচনা করেন প্রতিনিধিরা।',
        'সম্মেলনের সমাপনী যৌথ ঘোষণায় নদীর বন্যা ও ঘূর্ণিঝড়ের জন্য অঞ্চলজুড়ে একটি অভিন্ন পূর্ব-সতর্কীকরণ নেটওয়ার্ক গড়ার আহ্বান জানানো হয়।',
      ],
    },
  },
  {
    slug: 'local-govt-reform-bill',
    category: 'politics',
    location: 'dhaka',
    en: {
      title: 'Parliament Passes New Local Government Reform Bill',
      excerpt: 'The bill grants municipal bodies greater budget autonomy and introduces direct public hearings before major local infrastructure projects.',
      body: [
        'Parliament has passed a new local government reform bill granting municipal bodies greater autonomy over their own budgets.',
        'The bill also introduces mandatory public hearings before major local infrastructure projects can be approved, a measure supporters say will increase transparency.',
      ],
    },
    bn: {
      title: 'স্থানীয় সরকার সংস্কার বিল পাস করল সংসদ',
      excerpt: 'নতুন বিলের ফলে পৌর সংস্থাগুলো নিজেদের বাজেটে বেশি স্বায়ত্তশাসন পাবে এবং বড় অবকাঠামো প্রকল্পের আগে সরাসরি গণশুনানি বাধ্যতামূলক হবে।',
      body: [
        'সংসদে নতুন স্থানীয় সরকার সংস্কার বিল পাস হয়েছে, যার ফলে পৌর সংস্থাগুলো নিজেদের বাজেট পরিচালনায় বেশি স্বায়ত্তশাসন পাবে।',
        'বিলে বড় স্থানীয় অবকাঠামো প্রকল্প অনুমোদনের আগে বাধ্যতামূলক গণশুনানির বিধানও রাখা হয়েছে, যা স্বচ্ছতা বাড়াবে বলে মনে করছেন সমর্থকরা।',
      ],
    },
  },
  {
    slug: 'textile-exports-record',
    category: 'business',
    location: 'gazipur',
    en: {
      title: 'Textile Exports Cross Record $4 Billion in a Single Quarter',
      excerpt: 'Garment manufacturers credit new automation investment and diversified export markets for the quarterly record.',
      body: [
        'Bangladesh\'s textile and garment sector has crossed $4 billion in exports for a single quarter for the first time, industry data shows.',
        'Manufacturers credited recent investment in automation and a push into new export markets in the Middle East and East Asia for the record.',
      ],
    },
    bn: {
      title: 'এক প্রান্তিকে রেকর্ড ৪ বিলিয়ন ডলার পোশাক রপ্তানি',
      excerpt: 'নতুন প্রযুক্তি বিনিয়োগ ও রপ্তানি বাজার বৈচিত্র্যকরণকে এই প্রান্তিক রেকর্ডের কারণ বলছেন পোশাক প্রস্তুতকারকরা।',
      body: [
        'শিল্প খাতের তথ্য অনুযায়ী, বাংলাদেশের বস্ত্র ও পোশাক খাত প্রথমবারের মতো এক প্রান্তিকে ৪ বিলিয়ন ডলারের বেশি রপ্তানি অতিক্রম করেছে।',
        'প্রস্তুতকারকরা বলছেন, সাম্প্রতিক স্বয়ংক্রিয়করণে বিনিয়োগ এবং মধ্যপ্রাচ্য ও পূর্ব এশিয়ার নতুন বাজারে প্রবেশের কারণেই এই রেকর্ড সম্ভব হয়েছে।',
      ],
    },
  },
  {
    slug: 'bangladesh-bank-rate-cut',
    category: 'economy',
    location: 'dhaka',
    en: {
      title: 'Bangladesh Bank Cuts Policy Rate to Support Growth',
      excerpt: 'The central bank lowered its key policy rate by 50 basis points, citing easing inflation and a need to support private investment.',
      body: [
        'Bangladesh Bank has cut its key policy rate by 50 basis points, citing easing inflation and a need to support private sector investment.',
        'Economists said the move gives commercial banks more room to lower lending rates for small and medium enterprises in the coming months.',
      ],
    },
    bn: {
      title: 'প্রবৃদ্ধি সহায়তায় নীতি সুদহার কমাল বাংলাদেশ ব্যাংক',
      excerpt: 'মূল্যস্ফীতি কিছুটা কমে আসা এবং বেসরকারি বিনিয়োগে সহায়তার প্রয়োজনীয়তার কথা উল্লেখ করে নীতি সুদহার ৫০ বেসিস পয়েন্ট কমিয়েছে কেন্দ্রীয় ব্যাংক।',
      body: [
        'বাংলাদেশ ব্যাংক তাদের মূল নীতি সুদহার ৫০ বেসিস পয়েন্ট কমিয়েছে, যার কারণ হিসেবে মূল্যস্ফীতি কিছুটা কমে আসা এবং বেসরকারি খাতে বিনিয়োগে সহায়তার প্রয়োজনীয়তার কথা বলা হয়েছে।',
        'অর্থনীতিবিদরা বলছেন, এর ফলে আগামী কয়েক মাসে ক্ষুদ্র ও মাঝারি উদ্যোক্তাদের জন্য ঋণের সুদহার কমানোর সুযোগ পাবে বাণিজ্যিক ব্যাংকগুলো।',
      ],
    },
  },
  {
    slug: 'cricket-series-win-sri-lanka',
    category: 'sports',
    location: 'dhaka',
    en: {
      title: 'Bangladesh Cricket Team Wins Series Against Sri Lanka',
      excerpt: 'A dominant all-round performance in the final match sealed a 2-1 series victory at home.',
      body: [
        'Bangladesh sealed a 2-1 series win over Sri Lanka after a dominant all-round performance in the final match at home.',
        'The captain praised the bowling unit\'s consistency throughout the series and said the win would boost the team\'s confidence ahead of the upcoming tour.',
      ],
    },
    bn: {
      title: 'শ্রীলঙ্কাকে সিরিজে হারাল বাংলাদেশ',
      excerpt: 'শেষ ম্যাচে দুর্দান্ত সর্বাঙ্গীণ পারফরম্যান্সে ঘরের মাঠে ২-১ ব্যবধানে সিরিজ জিতল বাংলাদেশ।',
      body: [
        'ঘরের মাঠে শেষ ম্যাচে দুর্দান্ত সর্বাঙ্গীণ পারফরম্যান্স দেখিয়ে শ্রীলঙ্কার বিপক্ষে ২-১ ব্যবধানে সিরিজ জিতেছে বাংলাদেশ।',
        'অধিনায়ক পুরো সিরিজে বোলিং ইউনিটের ধারাবাহিকতার প্রশংসা করেছেন এবং বলেছেন, এই জয় আসন্ন সফরের আগে দলের আত্মবিশ্বাস বাড়াবে।',
      ],
    },
  },
  {
    slug: 'ai-farming-app-launch',
    category: 'technology',
    location: 'bogra',
    en: {
      title: 'Local Startup Launches AI-Powered Farming App for Rural Farmers',
      excerpt: 'The app gives crop advice in Bangla using photos taken from a farmer\'s phone, and works offline in low-connectivity areas.',
      body: [
        'A Dhaka-based startup has launched a mobile app that gives farmers crop-disease advice in Bangla based on photos taken with their own phones.',
        'The app is designed to work offline in low-connectivity rural areas, syncing data automatically once a connection becomes available.',
      ],
    },
    bn: {
      title: 'কৃষকদের জন্য এআই-চালিত অ্যাপ চালু করল স্থানীয় স্টার্টআপ',
      excerpt: 'ফোনে তোলা ছবি থেকে বাংলায় ফসলের পরামর্শ দেয় অ্যাপটি, এবং কম ইন্টারনেট সংযোগের এলাকায়ও অফলাইনে কাজ করে।',
      body: [
        'ঢাকাভিত্তিক একটি স্টার্টআপ একটি মোবাইল অ্যাপ চালু করেছে, যা কৃষকদের নিজের ফোনে তোলা ছবির ভিত্তিতে বাংলায় ফসলের রোগ সম্পর্কে পরামর্শ দেয়।',
        'অ্যাপটি কম ইন্টারনেট সংযোগের গ্রামীণ এলাকায় অফলাইনে কাজ করার উপযোগী করে তৈরি, এবং সংযোগ পাওয়া গেলে স্বয়ংক্রিয়ভাবে তথ্য সমন্বয় করে।',
      ],
    },
  },
  {
    slug: 'dhaka-film-festival-opens',
    category: 'entertainment',
    location: 'dhaka',
    en: {
      title: 'Dhaka International Film Festival Opens With Record Entries',
      excerpt: 'This year\'s festival received entries from over 60 countries, with a dedicated new section for short films by young Bangladeshi directors.',
      body: [
        'The Dhaka International Film Festival opened this week with a record number of entries from more than 60 countries.',
        'Organizers introduced a new dedicated section this year for short films by young Bangladeshi directors, screening over a dozen debut works.',
      ],
    },
    bn: {
      title: 'রেকর্ড সংখ্যক ছবি নিয়ে শুরু হলো ঢাকা আন্তর্জাতিক চলচ্চিত্র উৎসব',
      excerpt: 'এবারের উৎসবে ৬০টিরও বেশি দেশ থেকে ছবি জমা পড়েছে, তরুণ বাংলাদেশি নির্মাতাদের স্বল্পদৈর্ঘ্য চলচ্চিত্রের জন্য যুক্ত হয়েছে নতুন বিভাগ।',
      body: [
        'এই সপ্তাহে ৬০টিরও বেশি দেশ থেকে রেকর্ড সংখ্যক ছবি নিয়ে শুরু হয়েছে ঢাকা আন্তর্জাতিক চলচ্চিত্র উৎসব।',
        'আয়োজকরা এবার তরুণ বাংলাদেশি নির্মাতাদের স্বল্পদৈর্ঘ্য চলচ্চিত্রের জন্য নতুন একটি বিভাগ চালু করেছেন, যেখানে এক ডজনেরও বেশি প্রথম কাজ প্রদর্শিত হচ্ছে।',
      ],
    },
  },
  {
    slug: 'digital-curriculum-secondary-schools',
    category: 'education',
    location: 'dhaka',
    en: {
      title: 'Government Introduces New Digital Curriculum for Secondary Schools',
      excerpt: 'The updated curriculum adds basic coding and digital literacy classes starting from grade six nationwide.',
      body: [
        'The education ministry has introduced an updated secondary school curriculum that adds basic coding and digital literacy classes starting from grade six.',
        'Teacher training for the new curriculum will begin next month, with full rollout expected across all districts within the academic year.',
      ],
    },
    bn: {
      title: 'মাধ্যমিক বিদ্যালয়ে নতুন ডিজিটাল পাঠ্যক্রম চালু করল সরকার',
      excerpt: 'নতুন পাঠ্যক্রমে সারাদেশে ষষ্ঠ শ্রেণি থেকে মৌলিক কোডিং ও ডিজিটাল সাক্ষরতার ক্লাস যুক্ত হচ্ছে।',
      body: [
        'শিক্ষা মন্ত্রণালয় মাধ্যমিক বিদ্যালয়ের জন্য হালনাগাদ পাঠ্যক্রম চালু করেছে, যাতে ষষ্ঠ শ্রেণি থেকে মৌলিক কোডিং ও ডিজিটাল সাক্ষরতার ক্লাস যুক্ত করা হয়েছে।',
        'নতুন পাঠ্যক্রমের জন্য শিক্ষক প্রশিক্ষণ আগামী মাসে শুরু হবে, এবং চলতি শিক্ষাবর্ষের মধ্যেই সব জেলায় পূর্ণাঙ্গ বাস্তবায়ন প্রত্যাশিত।',
      ],
    },
  },
  {
    slug: 'rural-health-clinics-open',
    category: 'health',
    location: 'jhenaidah',
    en: {
      title: 'New Community Health Clinics Open Across Rural Districts',
      excerpt: 'The clinics will offer free basic checkups and maternal care, part of a wider push to expand rural healthcare access.',
      body: [
        'The health ministry has opened a new round of community health clinics across several rural districts, offering free basic checkups and maternal care.',
        'Officials said the clinics are part of a wider push to expand healthcare access for communities located far from district hospitals.',
      ],
    },
    bn: {
      title: 'গ্রামীণ জেলাগুলোতে চালু হলো নতুন কমিউনিটি স্বাস্থ্যকেন্দ্র',
      excerpt: 'এই কেন্দ্রগুলোতে বিনামূল্যে প্রাথমিক স্বাস্থ্য পরীক্ষা ও মাতৃসেবা দেওয়া হবে, যা গ্রামীণ স্বাস্থ্যসেবা সম্প্রসারণের বৃহত্তর উদ্যোগের অংশ।',
      body: [
        'স্বাস্থ্য মন্ত্রণালয় বেশ কয়েকটি গ্রামীণ জেলায় নতুন কমিউনিটি স্বাস্থ্যকেন্দ্র চালু করেছে, যেখানে বিনামূল্যে প্রাথমিক স্বাস্থ্য পরীক্ষা ও মাতৃসেবা দেওয়া হচ্ছে।',
        'কর্মকর্তারা বলছেন, জেলা হাসপাতাল থেকে দূরে থাকা জনগোষ্ঠীর জন্য স্বাস্থ্যসেবা সম্প্রসারণের বৃহত্তর উদ্যোগের অংশ এই কেন্দ্রগুলো।',
      ],
    },
  },
  {
    slug: 'port-city-smuggling-ring-busted',
    category: 'crime',
    location: 'coxs-bazar',
    en: {
      title: 'Police Dismantle Major Smuggling Ring in Port City',
      excerpt: 'Authorities say the operation, months in the making, recovered a large quantity of contraband and led to several arrests.',
      body: [
        'Police say a months-long investigation has led to the dismantling of a major smuggling ring operating out of a port city.',
        'Authorities recovered a large quantity of contraband during the operation and made several arrests, with further arrests expected as the investigation continues.',
      ],
    },
    bn: {
      title: 'বন্দর নগরীতে বড় চোরাচালান চক্র ভেঙে দিল পুলিশ',
      excerpt: 'মাসব্যাপী অভিযানে বিপুল পরিমাণ চোরাচালান পণ্য উদ্ধার এবং বেশ কয়েকজনকে গ্রেপ্তার করা হয়েছে বলে জানিয়েছেন কর্মকর্তারা।',
      body: [
        'পুলিশ জানিয়েছে, মাসব্যাপী তদন্তের পর বন্দর নগরীতে সক্রিয় একটি বড় চোরাচালান চক্র ভেঙে দেওয়া হয়েছে।',
        'অভিযানে বিপুল পরিমাণ চোরাচালান পণ্য উদ্ধার করা হয়েছে এবং বেশ কয়েকজনকে গ্রেপ্তার করা হয়েছে, তদন্ত চলমান থাকায় আরও গ্রেপ্তারের সম্ভাবনা রয়েছে।',
      ],
    },
  },
  {
    slug: 'rooftop-gardening-trend',
    category: 'lifestyle',
    location: 'dhaka',
    en: {
      title: 'Urban Rooftop Gardening Trend Grows Among Dhaka Residents',
      excerpt: 'More apartment dwellers are turning bare rooftops into small vegetable gardens, citing fresher produce and stress relief.',
      body: [
        'A growing number of Dhaka apartment dwellers are turning bare rooftops into small vegetable gardens.',
        'Enthusiasts cite fresher produce and stress relief as the main draws, with several housing societies now organizing shared rooftop garden spaces.',
      ],
    },
    bn: {
      title: 'ঢাকাবাসীর মধ্যে বাড়ছে ছাদ বাগানের জনপ্রিয়তা',
      excerpt: 'অনেক ফ্ল্যাটবাসী খালি ছাদকে ছোট সবজি বাগানে রূপান্তরিত করছেন, তাজা সবজি ও মানসিক প্রশান্তির কথা বলছেন তারা।',
      body: [
        'ঢাকার ক্রমবর্ধমান সংখ্যক ফ্ল্যাটবাসী তাদের খালি ছাদকে ছোট সবজি বাগানে রূপান্তরিত করছেন।',
        'উৎসাহীরা বলছেন, তাজা সবজি ও মানসিক প্রশান্তিই এর মূল কারণ, এবং বেশ কিছু আবাসন সমিতি এখন যৌথ ছাদ বাগানের ব্যবস্থা করছে।',
      ],
    },
  },
  {
    slug: 'coxs-bazar-tourist-record',
    category: 'travel',
    location: 'coxs-bazar',
    en: {
      title: "Cox's Bazar Sees Record Tourist Arrivals This Season",
      excerpt: 'Hotel occupancy hit its highest level in years, with local businesses reporting a strong boost in seasonal revenue.',
      body: [
        "Cox's Bazar has seen record tourist arrivals this season, with hotel occupancy reaching its highest level in years.",
        'Local businesses reported a strong boost in seasonal revenue, and authorities said new transport links have made the trip more convenient for visitors.',
      ],
    },
    bn: {
      title: 'এবারের মৌসুমে রেকর্ড পর্যটক কক্সবাজারে',
      excerpt: 'বছরের সর্বোচ্চ হোটেল বুকিং রেকর্ড হয়েছে, স্থানীয় ব্যবসায়ীরা মৌসুমি আয়ে বড় প্রবৃদ্ধির কথা জানিয়েছেন।',
      body: [
        'এই মৌসুমে কক্সবাজারে রেকর্ড সংখ্যক পর্যটক এসেছেন, এবং হোটেল বুকিং কয়েক বছরের মধ্যে সর্বোচ্চ পর্যায়ে পৌঁছেছে।',
        'স্থানীয় ব্যবসায়ীরা মৌসুমি আয়ে বড় প্রবৃদ্ধির কথা জানিয়েছেন, এবং কর্তৃপক্ষ বলছে নতুন পরিবহন যোগাযোগ পর্যটকদের যাত্রা আরও সহজ করেছে।',
      ],
    },
  },
  {
    slug: 'flood-resistant-rice-variety',
    category: 'science',
    location: 'rajshahi',
    en: {
      title: 'Bangladeshi Researchers Develop Flood-Resistant Rice Variety',
      excerpt: 'The new variety can survive up to two weeks fully submerged, offering hope for farmers in flood-prone districts.',
      body: [
        'Researchers at a national agricultural institute have developed a new rice variety that can survive up to two weeks fully submerged in floodwater.',
        'Field trials in flood-prone districts showed significantly higher survival rates compared to conventional varieties, offering hope to farmers facing increasingly unpredictable monsoons.',
      ],
    },
    bn: {
      title: 'বন্যা সহনশীল ধানের নতুন জাত উদ্ভাবন করলেন বাংলাদেশি গবেষকরা',
      excerpt: 'নতুন জাতটি সম্পূর্ণ পানিতে ডুবে থেকেও দুই সপ্তাহ পর্যন্ত টিকে থাকতে পারে, যা বন্যাপ্রবণ জেলার কৃষকদের জন্য নতুন আশার সঞ্চার করছে।',
      body: [
        'একটি জাতীয় কৃষি গবেষণা প্রতিষ্ঠানের গবেষকরা নতুন একটি ধানের জাত উদ্ভাবন করেছেন, যা সম্পূর্ণ পানিতে ডুবে থেকেও দুই সপ্তাহ পর্যন্ত টিকে থাকতে পারে।',
        'বন্যাপ্রবণ জেলাগুলোতে মাঠ পরীক্ষায় প্রচলিত জাতের তুলনায় উল্লেখযোগ্যভাবে বেশি টিকে থাকার হার দেখা গেছে, যা অনিশ্চিত বর্ষার মুখোমুখি কৃষকদের জন্য নতুন আশা।',
      ],
    },
  },
  {
    slug: 'tongi-peace-convention',
    category: 'religion',
    location: 'gazipur',
    en: {
      title: 'Thousands Gather for Annual Peace Convention in Tongi',
      excerpt: 'The multi-day gathering drew attendees from across the country and abroad, with local authorities coordinating transport and security.',
      body: [
        'Thousands of attendees gathered in Tongi this week for the annual multi-day peace convention, drawing visitors from across the country and abroad.',
        'Local authorities coordinated special transport arrangements and additional security for the duration of the gathering.',
      ],
    },
    bn: {
      title: 'টঙ্গীতে বার্ষিক শান্তি সম্মেলনে লাখো মানুষের সমাগম',
      excerpt: 'কয়েক দিনব্যাপী এই সম্মেলনে দেশ-বিদেশ থেকে অংশগ্রহণকারীরা এসেছেন, স্থানীয় প্রশাসন পরিবহন ও নিরাপত্তার ব্যবস্থা সমন্বয় করেছে।',
      body: [
        'এই সপ্তাহে টঙ্গীতে বার্ষিক কয়েক দিনব্যাপী শান্তি সম্মেলনে হাজারো মানুষের সমাগম ঘটেছে, যেখানে দেশ-বিদেশ থেকে দর্শনার্থীরা এসেছেন।',
        'সম্মেলন চলাকালীন স্থানীয় প্রশাসন বিশেষ পরিবহন ব্যবস্থা ও অতিরিক্ত নিরাপত্তার সমন্বয় করেছে।',
      ],
    },
  },
];

async function main() {
  console.log(`Seeding ${STORIES.length} demo news stories (${STORIES.length * 2} articles, bn+en pairs)...\n`);

  const languages = await prisma.language.findMany({ select: { id: true, code: true } });
  const bnLanguageId = languages.find((l) => l.code === 'bn')?.id;
  const enLanguageId = languages.find((l) => l.code === 'en')?.id;
  if (!bnLanguageId || !enLanguageId) throw new Error('bn/en Language rows not found — run the main seed first.');

  const admin = await prisma.user.findFirst({
    where: { userRoles: { some: { role: { name: 'Super Admin' } } } },
    select: { id: true },
  });
  if (!admin) throw new Error('No Super Admin user found — run the main seed first.');

  const demoTag = await prisma.tag.upsert({
    where: { slug: DEMO_TAG_SLUG },
    update: {},
    create: { name: 'Demo Content', slug: DEMO_TAG_SLUG },
  });
  for (const [languageId, name] of [[bnLanguageId, 'ডেমো কন্টেন্ট'], [enLanguageId, 'Demo Content']]) {
    await prisma.tagTranslation.upsert({
      where: { tagId_languageId: { tagId: demoTag.id, languageId } },
      update: {},
      create: { tagId: demoTag.id, languageId, name, slug: DEMO_TAG_SLUG },
    });
  }

  let created = 0;
  for (let i = 0; i < STORIES.length; i++) {
    const story = STORIES[i];
    const category = await prisma.category.findUnique({ where: { slug: story.category } });
    const location = story.location ? await prisma.location.findFirst({ where: { slug: story.location } }) : null;
    // Stagger publish times so "Latest" ordering looks natural instead of 30 identical timestamps.
    const publishedAt = new Date(Date.now() - (STORIES.length - i) * 6 * 60 * 60 * 1000);

    const bnSlug = `demo-${story.slug}-bn`;
    const enSlug = `demo-${story.slug}-en`;

    const bnArticle = await prisma.article.upsert({
      where: { slug: bnSlug },
      update: {},
      create: {
        title: story.bn.title,
        slug: bnSlug,
        excerpt: story.bn.excerpt,
        content: doc(story.bn.body),
        status: ArticleStatus.PUBLISHED,
        authorId: admin.id,
        categoryId: category?.id ?? null,
        locationId: location?.id ?? null,
        languageId: bnLanguageId,
        publishedAt,
        reviewedAt: publishedAt,
        reviewedById: admin.id,
        articleTags: { create: [{ tagId: demoTag.id }] },
      },
    });

    let groupId = bnArticle.translationGroupId;
    if (!groupId) {
      const updated = await prisma.article.update({
        where: { id: bnArticle.id },
        data: { translationGroup: { create: {} } },
        select: { translationGroupId: true },
      });
      groupId = updated.translationGroupId;
    }

    await prisma.article.upsert({
      where: { slug: enSlug },
      update: { translationGroupId: groupId },
      create: {
        title: story.en.title,
        slug: enSlug,
        excerpt: story.en.excerpt,
        content: doc(story.en.body),
        status: ArticleStatus.PUBLISHED,
        authorId: admin.id,
        categoryId: category?.id ?? null,
        locationId: location?.id ?? null,
        languageId: enLanguageId,
        translationGroupId: groupId,
        publishedAt,
        reviewedAt: publishedAt,
        reviewedById: admin.id,
        articleTags: { create: [{ tagId: demoTag.id }] },
      },
    });

    created += 2;
    console.log(`  ✓ [${story.category}] "${story.bn.title}" (bn) ↔ "${story.en.title}" (en)`);
  }

  console.log(`\nDone — ${created} demo articles created/updated (${STORIES.length} bn+en pairs), all tagged "${DEMO_TAG_SLUG}" and slug-prefixed "demo-".`);
  console.log('Run `node scripts/delete-demo-news.js` whenever you want to remove all of them before going live.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
