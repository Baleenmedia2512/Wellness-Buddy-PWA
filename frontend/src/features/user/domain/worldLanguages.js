/**
 * Languages a member can select on Profile. Codes are ISO 639-1.
 */
export const WORLD_LANGUAGES = Object.freeze([
  ['en', 'English'], ['hi', 'Hindi'], ['ta', 'Tamil'], ['te', 'Telugu'], ['kn', 'Kannada'],
  ['ml', 'Malayalam'], ['mr', 'Marathi'], ['bn', 'Bengali'], ['gu', 'Gujarati'], ['pa', 'Punjabi'],
  ['ur', 'Urdu'], ['or', 'Odia'], ['as', 'Assamese'], ['sa', 'Sanskrit'], ['ne', 'Nepali'],
  ['si', 'Sinhala'], ['ar', 'Arabic'], ['zh', 'Chinese'], ['es', 'Spanish'], ['fr', 'French'],
  ['de', 'German'], ['pt', 'Portuguese'], ['ru', 'Russian'], ['ja', 'Japanese'], ['ko', 'Korean'],
  ['it', 'Italian'], ['nl', 'Dutch'], ['pl', 'Polish'], ['tr', 'Turkish'], ['vi', 'Vietnamese'],
  ['th', 'Thai'], ['id', 'Indonesian'], ['ms', 'Malay'], ['fa', 'Persian'], ['he', 'Hebrew'],
  ['el', 'Greek'], ['sv', 'Swedish'], ['no', 'Norwegian'], ['da', 'Danish'], ['fi', 'Finnish'],
  ['cs', 'Czech'], ['sk', 'Slovak'], ['hu', 'Hungarian'], ['ro', 'Romanian'], ['bg', 'Bulgarian'],
  ['uk', 'Ukrainian'], ['sr', 'Serbian'], ['hr', 'Croatian'], ['sl', 'Slovenian'], ['lt', 'Lithuanian'],
  ['lv', 'Latvian'], ['et', 'Estonian'], ['sw', 'Swahili'], ['af', 'Afrikaans'], ['am', 'Amharic'],
  ['az', 'Azerbaijani'], ['be', 'Belarusian'], ['bs', 'Bosnian'], ['ca', 'Catalan'], ['ceb', 'Cebuano'],
  ['cy', 'Welsh'], ['eo', 'Esperanto'], ['eu', 'Basque'], ['fil', 'Filipino'], ['ga', 'Irish'],
  ['gl', 'Galician'], ['ha', 'Hausa'], ['hy', 'Armenian'], ['is', 'Icelandic'], ['ka', 'Georgian'],
  ['kk', 'Kazakh'], ['km', 'Khmer'], ['ky', 'Kyrgyz'], ['lo', 'Lao'], ['mk', 'Macedonian'],
  ['mn', 'Mongolian'], ['my', 'Burmese'], ['sq', 'Albanian'], ['uz', 'Uzbek'], ['yo', 'Yoruba'],
  ['zu', 'Zulu'], ['xh', 'Xhosa'], ['ig', 'Igbo'], ['rw', 'Kinyarwanda'], ['so', 'Somali'],
  ['ps', 'Pashto'], ['ku', 'Kurdish'], ['sd', 'Sindhi'], ['tg', 'Tajik'], ['tk', 'Turkmen'],
  ['tt', 'Tatar'], ['ug', 'Uyghur'], ['yi', 'Yiddish'], ['jv', 'Javanese'], ['su', 'Sundanese'],
  ['la', 'Latin'], ['mt', 'Maltese'], ['lb', 'Luxembourgish'], ['fy', 'Frisian'], ['gd', 'Scottish Gaelic'],
  ['mi', 'Maori'], ['sm', 'Samoan'], ['to', 'Tongan'], ['haw', 'Hawaiian'], ['mg', 'Malagasy'],
  ['ny', 'Chichewa'], ['sn', 'Shona'], ['st', 'Sesotho'], ['tn', 'Tswana'], ['ts', 'Tsonga'],
  ['co', 'Corsican'], ['ht', 'Haitian Creole'], ['hmn', 'Hmong'],
].map(([code, name]) => Object.freeze({ code, name })));

export const LANGUAGE_BY_CODE = Object.freeze(
  Object.fromEntries(WORLD_LANGUAGES.map((item) => [item.code, item.name])),
);
