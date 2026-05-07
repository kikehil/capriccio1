import { Pizza } from "@/data/menu";
import { ExtraOption } from "@/data/options";

export interface CartItem extends Pizza {
    size?: string; // e.g. 'Mini', 'Chica', 'Mediana', 'Grande'
    crust?: string; // 'Orilla Rellena de Queso (+$45)', etc.
    extras: ExtraOption[];
    totalItemPrice: number;
    quantity: number;
    cartId: string; // Identifier for identical configurations
    nota?: string;  // Nota adicional del cliente (sin cebolla, etc.)
    sauce?: string; // Tipo de salsa (para hamburguesas / boneless)
}
