import { CardConfig, CardType } from "@/types/dashboard";
import { CharacterListCard } from "./character-list-card";

interface CardContainerProps {
  roleId: string;
  cards: CardConfig[];
  onAddCard: (type: CardType) => void;
  onRemoveCard: (cardId: string) => void;
  onMoveCard: (cardId: string, direction: "up" | "down") => void;
}

export function CardContainer({
  roleId,
  cards,
  onAddCard,
  onRemoveCard,
  onMoveCard,
}: CardContainerProps) {
  return (
    <div className="space-y-4">
      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card, index) => (
          <div key={card.id} className="relative group">
            {/* Card Controls (visible on hover) */}
            <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              {/* Move Up Button */}
              {index > 0 && (
                <button
                  onClick={() => onMoveCard(card.id, "up")}
                  className="p-1 bg-content1 rounded-full shadow-md hover:bg-primary/10"
                  aria-label="Move up"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                </button>
              )}

              {/* Move Down Button */}
              {index < cards.length - 1 && (
                <button
                  onClick={() => onMoveCard(card.id, "down")}
                  className="p-1 bg-content1 rounded-full shadow-md hover:bg-primary/10"
                  aria-label="Move down"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              )}

              {/* Delete Button */}
              <button
                onClick={() => onRemoveCard(card.id)}
                className="p-1 bg-content1 rounded-full shadow-md hover:bg-danger/10 text-danger"
                aria-label="Delete card"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Render Card Based on Type */}
            {card.type === CardType.CHARACTER_LIST && (
              <CharacterListCard
                roleId={roleId}
                cardId={card.id}
                settings={card.settings}
              />
            )}

            {/* Future: Add other card types here */}
          </div>
        ))}
      </div>

      {/* Add Card Button */}
      <div className="flex justify-center">
        <button
          onClick={() => onAddCard(CardType.CHARACTER_LIST)}
          className="px-4 py-2 bg-content1 border border-separator rounded-lg hover:bg-primary/10 transition-colors flex items-center gap-2"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Card
        </button>
      </div>
    </div>
  );
}
