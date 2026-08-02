import React from 'react';
import { useTranslation } from 'react-i18next';
import { SearchableSelect } from '../../../shared/components/SearchableSelect';

interface Props {
  label: string;
  branches: any[];
  selectedId: any;
  onSelect: (id: any) => void;
  error?: string;
  theme?: any;
}

export default function BranchPicker({ label, branches, selectedId, onSelect, error }: Props) {
  const { t } = useTranslation();
  const items = branches.map((b) => ({
    value: b._id,
    label: b.name,
    sublabel: b.code,
  }));

  return (
    <SearchableSelect
      label={label}
      placeholder={t('common.search')}
      items={items}
      selectedValue={selectedId}
      onSelect={onSelect}
      error={error}
    />
  );
}
