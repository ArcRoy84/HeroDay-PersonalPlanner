// Category presets for user-created courses — kept broad so the section reads
// naturally whether someone is tracking a certification, a trade skill, or a
// hobby they're picking up in their spare time.
export const COURSE_CATEGORIES = {
  professional:  { label: 'Professional Skill', icon: '💼', color: '#4f8ef7', bg: 'rgba(79,142,247,0.12)' },
  certification: { label: 'Certification',      icon: '🎓', color: '#7c66ff', bg: 'rgba(124,102,255,0.12)' },
  language:      { label: 'Language',           icon: '🗣️', color: '#f5a623', bg: 'rgba(245,166,35,0.12)' },
  trade:         { label: 'Trade / Vocational', icon: '🛠️', color: '#e8663f', bg: 'rgba(232,102,63,0.12)' },
  hobby:         { label: 'Personal / Hobby',    icon: '🎨', color: '#e879a0', bg: 'rgba(232,121,160,0.12)' },
  life:          { label: 'Life Skill',          icon: '🌱', color: '#3ecf8e', bg: 'rgba(62,207,142,0.12)' },
};

export const COURSE_CATEGORY_KEYS = Object.keys(COURSE_CATEGORIES);

export function courseProgress(course) {
  if (course.mode === 'checklist') {
    const total = course.lessons.length;
    if (!total) return 0;
    return Math.round((course.lessons.filter(l => l.done).length / total) * 100);
  }
  return course.progress || 0;
}
