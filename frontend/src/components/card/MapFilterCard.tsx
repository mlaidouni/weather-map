import { Card } from "@/components/ui/card";

type MapFilterCardProps = {
  setSelected: React.Dispatch<React.SetStateAction<number>>;
  selected: number;
  img: string;
};

export default function MapFilterCard({
  setSelected,
  selected,
  img,
}: MapFilterCardProps) {
  return (
    <Card
      onClick={() => setSelected(selected === 0 ? 1 : 0)}
      className={`w-16 aspect-square shadow-md flex items-center justify-center cursor-pointer transition-colors ${
        selected === 1 ? "border-blue-500" : "border-white"
      }`}
    >
      <img src={img} alt="icon" className="w-8 h-8" />
    </Card>
  );
}
