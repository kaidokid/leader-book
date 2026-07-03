/** 书籍检索结果卡片 */
import type { BookResult } from '@/lib/types';
import { BookOpen, Check } from 'lucide-react';

interface Props {
  book: BookResult;
  selected: boolean;
  onSelect: () => void;
}

export default function BookCard({ book, selected, onSelect }: Props) {
  return (
    <button
      onClick={onSelect}
      className={`card flex w-full gap-3 p-3 text-left transition-all ${
        selected ? 'ring-2 ring-gold-400' : 'hover:border-gold-300'
      }`}
    >
      {/* 封面 */}
      <div className="h-24 w-16 flex-shrink-0 overflow-hidden rounded-md bg-ink-100">
        {book.thumbnail ? (
          <img
            src={book.thumbnail}
            alt={book.title}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-300">
            <BookOpen size={20} />
          </div>
        )}
      </div>

      {/* 信息 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="line-clamp-2 font-serif text-sm font-bold text-ink-900">
          {book.title}
        </h3>
        {book.authors.length > 0 && (
          <p className="mt-0.5 text-xs text-ink-500">
            {book.authors.join('、')}
          </p>
        )}
        {(book.publisher || book.publishedDate) && (
          <p className="text-xs text-ink-400">
            {[book.publisher, book.publishedDate].filter(Boolean).join(' · ')}
          </p>
        )}
        {book.description && (
          <p className="mt-1 line-clamp-2 text-xs text-ink-500">
            {book.description}
          </p>
        )}
      </div>

      {/* 选中标记 */}
      {selected && (
        <div className="flex flex-shrink-0 items-start">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-400 text-white">
            <Check size={14} />
          </div>
        </div>
      )}
    </button>
  );
}
