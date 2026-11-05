import { Navigate, useParams } from 'react-router-dom';

// Purane /learn/:id links ab dashboard par jate hain
export default function Learn() {
  const { id } = useParams();
  return <Navigate to={`/dashboard?course=${id}`} replace />;
}
