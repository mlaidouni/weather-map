export enum InterestPointTypeEnum {
    Restaurant = "restaurant",
    Toilets = "toilets",
    Supermarket = "supermarket"
}

//Ce type permet de représenter un point d'interet sur une carte
export type InterestPoint = {
    name: string;
    type: InterestPointTypeEnum;
    lat: number;
    lng: number;
};