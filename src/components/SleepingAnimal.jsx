import React, { useState } from 'react';
import './sleeping-animal.css';

import cat from '../assets/pets/cat.png';
import dog from '../assets/pets/dog.png';
import fox from '../assets/pets/fox.png';
import axolotl from '../assets/pets/axolotl.png';

const animals = [
  { id: 'cat', name: 'Gato', image: cat },
  { id: 'dog', name: 'Perro', image: dog },
  { id: 'fox', name: 'Zorro', image: fox },
  { id: 'axolotl', name: 'Ajolote', image: axolotl }
];

export default function SleepingAnimal() {
  const [index, setIndex] = useState(0);
  const animal = animals[index];
  const next = animals[(index + 1) % animals.length];
  return <div className="sleeping-animal-footer">
    <button className="sleeping-animal" onClick={() => setIndex((value) => (value + 1) % animals.length)} aria-label={`${animal.name} durmiendo. Cambiar a ${next.name.toLowerCase()}.`} title={`${animal.name} · Pulsa para cambiar de animal`}>
      <span className="pet-scene" aria-hidden="true">
        <img key={animal.id} className="pet-image" src={animal.image} alt="" width="1536" height="1024" draggable="false" />
        <svg className="pet-zzz" viewBox="0 0 24 18" shapeRendering="crispEdges">
          <path className="pet-z pet-z-one" d="M1 11h5v1H5v1H4v1H3v1h3v1H1v-1h1v-1h1v-1h1v-1H1z" />
          <path className="pet-z pet-z-two" d="M9 6h5v1h-1v1h-1v1h-1v1h3v1H9v-1h1V9h1V8h1V7H9z" />
          <path className="pet-z pet-z-three" d="M17 1h6v1h-1v1h-1v1h-1v1h3v1h-6V5h1V4h1V3h1V2h-3z" />
        </svg>
      </span>
    </button>
  </div>;
}
