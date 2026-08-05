export const GYMS = [
  {
    id: '1',
    name: 'FitZone Strength Studio',
    area: 'Koramangala',
    city: 'Bengaluru',
    rating: 4.9,
    reviewCount: 214,
    price: 149,
    tags: ['Free Weights', 'AC', 'Lockers'],
    desc: 'A no-frills strength studio with a full free-weights section and a serious evening crowd. Popular with travelers who lift regularly.',
    reviews: [
      { name: 'Aarav', rating: 5, text: 'Clean space, staff let me in without any fuss once I showed my booking.' },
      { name: 'Priya', rating: 5, text: 'Great equipment, was busy around 6pm but still got a good session in.' },
      { name: 'Karan', rating: 4, text: 'Good gym, parking is a bit tight nearby.' },
    ],
  },
  {
    id: '2',
    name: 'Core & More',
    area: 'Indiranagar',
    city: 'Bengaluru',
    rating: 4.7,
    reviewCount: 156,
    price: 169,
    tags: ['Ladies-Only', 'Functional Training'],
    desc: 'Boutique studio with dedicated ladies-only evening hours and a functional-training focus. Smaller, quieter than most gyms in the area.',
    reviews: [
      { name: 'Sneha', rating: 5, text: 'Loved the ladies-only slot, very comfortable atmosphere.' },
      { name: 'Meera', rating: 4, text: 'Good trainers on floor, equipment is slightly limited.' },
    ],
  },
  {
    id: '3',
    name: 'Tech Park Fitness',
    area: 'Whitefield',
    city: 'Bengaluru',
    rating: 4.6,
    reviewCount: 98,
    price: 99,
    tags: ['Cardio Zone', 'AC'],
    desc: 'Built for the tech-park crowd — quick check-in, a large treadmill bank, and quiet mornings. Good budget option.',
    reviews: [
      { name: 'Rohit', rating: 5, text: 'Cheapest good gym I found near Whitefield, will use again.' },
      { name: 'Divya', rating: 4, text: 'Cardio machines are new, weights section is small though.' },
    ],
  },
];

export function getGymById(id) {
  return GYMS.find((g) => g.id === id);
}
