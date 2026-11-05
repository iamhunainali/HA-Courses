// Default homepage layout (admin "Homepage" tab se "Load default layout" par database mein save hota hai)
export const DEFAULT_SECTIONS: any[] = [
  { type: 'hero', data: { slides: [
    { badge: 'Admissions open', title: 'Build job-ready skills online', subtitle: 'Structured video courses, downloadable notes and real projects. Learn at your own pace.',
      bullets: 'Learn anytime, on any device\nNotes and resources with every course\nSupport from instructors',
      buttonText: 'Explore courses', buttonLink: '/courses', button2Text: 'Create free account', button2Link: '/signup',
      bg: 'linear-gradient(135deg,#0f3d4c,#0f6b5c)', color: '#ffffff' },
    { badge: 'New programs', title: 'Specialization tracks', subtitle: 'Short, focused programs that take you from beginner to professional.',
      buttonText: 'View programs', buttonLink: '/courses', bg: 'linear-gradient(135deg,#2b1a5c,#5b3fb5)', color: '#ffffff' },
    { badge: 'Student voices', title: 'Learn with a community', subtitle: 'Read what our students say and share your own experience.',
      buttonText: 'Read reviews', buttonLink: '/reviews', bg: 'linear-gradient(135deg,#6b3300,#c2701a)', color: '#ffffff' },
  ] } },
  { type: 'stats', data: { bg: '#ffffff', items: [
    { value: '10K+', label: 'Learners' }, { value: '100+', label: 'Courses' }, { value: '4.8/5', label: 'Average rating' }, { value: '24/7', label: 'Access' } ] } },
  { type: 'chips', data: { title: 'Find your learning path', subtitle: 'Choose what fits your level', items: [
    { label: 'Beginner', link: '/courses' }, { label: 'Student', link: '/courses' }, { label: 'Graduate', link: '/courses' }, { label: 'Working professional', link: '/courses' } ] } },
  { type: 'courses', data: { title: 'Popular courses', subtitle: 'Pick a course and enroll in one click', limit: 8, showTabs: false } },
  { type: 'steps', data: { bg: '#ffffff', title: 'Your path to success', subtitle: 'Register. Learn. Achieve.', items: [
    { icon: '📝', title: 'Register', text: 'Create your free account' }, { icon: '📚', title: 'Learn', text: 'Watch lessons and read notes' },
    { icon: '🛠️', title: 'Practice', text: 'Apply what you learned' }, { icon: '🎓', title: 'Achieve', text: 'Reach your career goal' } ] } },
  { type: 'feature', data: { badge: 'Hands-on', title: 'Practice with real projects', text: 'Every course is built around practical work so you can show real results.',
    bullets: 'Guided exercises\nDownloadable resources\nInstructor feedback', buttonText: 'Browse courses', buttonLink: '/courses', imageSide: 'right' } },
  { type: 'reviews', data: { title: '' } },
  { type: 'richtext', data: { bg: '#ffffff', title: 'Why learn with us', body: 'Our platform brings together flexible, self-paced learning and carefully prepared course material.\n\n## Flexible learning\nStudy whenever you want, from anywhere, on any device.\n\n## Practical content\nVideos, notes and resources prepared by instructors, available in your dashboard after you enroll.' } },
  { type: 'cta', data: { title: 'Ready to start learning?', text: 'Create your free account and enroll in your first course today.', buttonText: 'Sign up free', buttonLink: '/signup', bg: 'linear-gradient(135deg,#0f3d4c,#0f6b5c)', color: '#ffffff' } },
];
