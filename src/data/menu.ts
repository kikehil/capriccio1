export interface Pizza {
    id: number;
    nombre: string;
    descripcion: string;
    precio: number;
    imagen: string;
    categoria: string;
    activo: boolean; // Control de disponibilidad
    precios?: Record<string, number>; // Precios variantes dependiendo el tamaño
    ingredientes?: string[];          // Ingredientes de la especialidad (para extras)
}

// "🔥 Promos", "🍕 Pizzas", "🍔 Hamburguesas", "🍟 Snacks & Más"
export const pizzas: Pizza[] = [
    {
        id: 1,
        nombre: "Pepperoni Capriccio",
        descripcion: "Doble porción de pepperoni premium sobre una base de mozarella artesanal y un toque de orégano fresco.",
        precio: 50,
        imagen: "https://images.unsplash.com/photo-1628840042765-356cda07504e?q=80&w=800",
        categoria: "🍕 Pizzas",
        activo: true
    },
    {
        id: 2,
        nombre: "Mexicana de la Huasteca",
        descripcion: "Chorizo artesanal, jalapeño fresco, cebolla morada y frijoles refritos sobre masa crujiente.",
        precio: 50,
        imagen: "https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?q=80&w=800",
        categoria: "🍕 Pizzas",
        activo: true
    },
    {
        id: 3,
        nombre: "Hawaiana al Horno",
        descripcion: "Jamón glaseado en su jugo, piña miel rostizada y extra queso mozzarella fundido.",
        precio: 50,
        imagen: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=800",
        categoria: "🍕 Pizzas",
        activo: true
    },
    {
        id: 4,
        nombre: "Gran Capriccio de Carnes",
        descripcion: "Salami italiano, jamón ahumado, salchicha artesanal y tocino premium crujiente.",
        precio: 50,
        imagen: "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=800",
        categoria: "🍕 Pizzas",
        activo: true
    },
    {
        id: 5,
        nombre: "Hamburguesa Capriccio Clásica",
        descripcion: "Carne de res premium 150g, queso cheddar fundido, lechuga, tomate y nuestro pan artesanal.",
        precio: 120,
        imagen: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=800", // Using a burger image
        categoria: "🍔 Hamburguesas",
        activo: true
    },
    {
        id: 6,
        nombre: "Hamburguesa Doble Extrema",
        descripcion: "Doble carne de res, doble queso, tocino crujiente, aros de cebolla y salsa BBQ.",
        precio: 180,
        imagen: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?q=80&w=800", // Using a burger image
        categoria: "🍔 Hamburguesas",
        activo: true
    },
    {
        id: 7,
        nombre: "Alitas BBQ (6 pzas)",
        descripcion: "Alitas horneadas y bañadas en nuestra salsa BBQ artesanal, acompañadas de aderezo ranch.",
        precio: 120,
        imagen: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?q=80&w=800",
        categoria: "🍟 Snacks & Más",
        activo: true
    },
    {
        id: 8,
        nombre: "Dedos de Queso (5 pzas)",
        descripcion: "Crujientes por fuera y derretidos por dentro. Perfectos para compartir.",
        precio: 85,
        imagen: "https://images.unsplash.com/photo-1528736235302-52922df5c122?q=80&w=800", // Fries / Mozzarella sticks image approx
        categoria: "🍟 Snacks & Más",
        activo: true
    }
];
